import json
from decimal import Decimal
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.conf import settings
import stripe

from .models import (
    User, Follow, Task, TaskCompletion, AdminCampaign, CampaignSubmission,
    Product, ProductMessage, Notification, RecentActivity, FundingPayment,
)


def _img(request, field):
    if not field:
        return ''
    try:
        return request.build_absolute_uri(field.url)
    except Exception:
        return ''


def _is_market_country(user):
    return (user.country or '').strip().lower() in {
        'uk','gb','gbr','united kingdom','great britain','england','scotland','wales','northern ireland',
        'nigeria','ng','nga',
    }


def _admin(user):
    return bool(user.is_staff or user.is_superuser)


@login_required
@require_http_methods(['GET'])
def mobile_public_profile(request, username):
    u = get_object_or_404(User, username__iexact=username)
    return JsonResponse({
        'username': u.username,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'country': u.country,
        'is_member': u.is_member,
        'followers': u.followers_set.count(),
        'following': u.following_set.count(),
        'is_following': Follow.objects.filter(follower=request.user, following=u).exists(),
        'is_self': request.user.pk == u.pk,
    })


@login_required
@require_http_methods(['GET'])
def mobile_search(request):
    q = (request.GET.get('q') or '').strip()
    if not q:
        return JsonResponse({'users': [], 'tasks': [], 'products': []})
    users = User.objects.filter(Q(username__icontains=q)|Q(first_name__icontains=q)|Q(last_name__icontains=q))[:20]
    tasks = Task.objects.filter(Q(title__icontains=q)|Q(platforms__icontains=q), available__gt=0)[:20]
    products = Product.objects.filter(Q(title__icontains=q)|Q(category__icontains=q), is_sold=False)[:20] if _is_market_country(request.user) else []
    return JsonResponse({
        'users': [{'username':u.username,'name':f'{u.first_name} {u.last_name}'.strip(),'country':u.country} for u in users],
        'tasks': [{'id':t.id,'title':t.title,'platform':t.platforms,'task_type':t.task_type,'reward':str(t.worker_reward),'available':t.available} for t in tasks],
        'products': [{'id':p.id,'title':p.title,'price':str(p.price),'seller':p.seller.username,'category':p.category,'image':_img(request,p.image)} for p in products],
    })


@login_required
@require_http_methods(['GET'])
def mobile_recent_activity(request):
    rows = RecentActivity.objects.all()[:40]
    return JsonResponse({'activities':[
        {'username':x.username,'platform':x.platform,'message':x.message,'amount':str(x.amount),'created_at':x.created_at.strftime('%d %b %Y, %I:%M %p')}
        for x in rows
    ]})


@login_required
@require_http_methods(['GET'])
def mobile_task_reviews(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    if task.creator_id != request.user.id and not _admin(request.user):
        return JsonResponse({'error':'Not allowed.'}, status=403)
    status = (request.GET.get('status') or 'pending').lower()
    if status not in {'pending','approved','rejected'}: status='pending'
    qs = TaskCompletion.objects.filter(task=task, status=status).select_related('user').order_by('-completed_at')
    return JsonResponse({'task':{'id':task.id,'title':task.title},'status':status,'submissions':[
        {'id':s.id,'worker':s.user.username,'reward':str(s.reward_amount),'proof':_img(request,s.proof),'submitted_at':s.completed_at.strftime('%d %b %Y, %I:%M %p'),'reviewed_at':s.reviewed_at.strftime('%d %b %Y, %I:%M %p') if s.reviewed_at else ''}
        for s in qs
    ]})


@login_required
@require_http_methods(['GET'])
def mobile_market_product(request, product_id):
    if not _is_market_country(request.user): return JsonResponse({'error':'Marketplace unavailable in your country.'},status=403)
    p=get_object_or_404(Product.objects.select_related('seller').prefetch_related('images'),id=product_id)
    return JsonResponse({'product':{
        'id':p.id,'title':p.title,'price':str(p.price),'description':p.description,'category':p.category,'is_sold':p.is_sold,
        'seller':p.seller.username,'seller_id':p.seller_id,'is_mine':p.seller_id==request.user.id,
        'image':_img(request,p.image),'images':[_img(request,x.image) for x in p.images.all()],
    }})


@login_required
@require_http_methods(['GET','POST','DELETE'])
def mobile_cart(request):
    if not _is_market_country(request.user): return JsonResponse({'error':'Marketplace unavailable in your country.'},status=403)
    cart = request.session.get('cart', [])
    if request.method == 'POST':
        data = json.loads(request.body or '{}') if request.content_type and 'json' in request.content_type else request.POST
        pid = int(data.get('product_id') or 0)
        p=get_object_or_404(Product,id=pid,is_sold=False)
        if p.seller_id==request.user.id: return JsonResponse({'error':'You cannot buy your own listing.'},status=400)
        if pid not in cart: cart.append(pid)
        request.session['cart']=cart
    elif request.method == 'DELETE':
        data=json.loads(request.body or '{}'); pid=int(data.get('product_id') or 0)
        cart=[x for x in cart if int(x)!=pid]; request.session['cart']=cart
    products=Product.objects.filter(id__in=cart,is_sold=False).select_related('seller')
    total=sum((p.price for p in products),Decimal('0.00'))
    return JsonResponse({'items':[{'id':p.id,'title':p.title,'price':str(p.price),'seller':p.seller.username,'image':_img(request,p.image)} for p in products],'total':str(total),'count':products.count()})


@login_required
@require_http_methods(['GET'])
def mobile_messages(request):
    if not _is_market_country(request.user): return JsonResponse({'error':'Marketplace unavailable in your country.'},status=403)
    qs=ProductMessage.objects.filter(Q(sender=request.user)|Q(receiver=request.user)).select_related('product','sender','receiver').order_by('-created_at')
    seen=set(); threads=[]
    for m in qs:
        other=m.receiver if m.sender_id==request.user.id else m.sender
        key=(m.product_id,other.id)
        if key in seen: continue
        seen.add(key)
        threads.append({'product_id':m.product_id,'product_title':m.product.title,'other_id':other.id,'other_username':other.username,'last_message':m.message,'created_at':m.created_at.strftime('%d %b %Y, %I:%M %p'),'unread':ProductMessage.objects.filter(product_id=m.product_id,sender=other,receiver=request.user,is_read=False).count()})
    return JsonResponse({'threads':threads})


@login_required
@require_http_methods(['GET','POST'])
def mobile_conversation(request, product_id, user_id):
    if not _is_market_country(request.user): return JsonResponse({'error':'Marketplace unavailable in your country.'},status=403)
    p=get_object_or_404(Product,id=product_id); other=get_object_or_404(User,id=user_id)
    if request.method=='POST':
        data=json.loads(request.body or '{}') if request.content_type and 'json' in request.content_type else request.POST
        text=(data.get('message') or '').strip()
        if not text: return JsonResponse({'error':'Message cannot be empty.'},status=400)
        ProductMessage.objects.create(product=p,sender=request.user,receiver=other,message=text)
        Notification.objects.create(user=other,title='Marketplace message',message=f'@{request.user.username} sent you a message about {p.title}.')
    ProductMessage.objects.filter(product=p,sender=other,receiver=request.user,is_read=False).update(is_read=True)
    qs=ProductMessage.objects.filter(product=p).filter(Q(sender=request.user,receiver=other)|Q(sender=other,receiver=request.user)).select_related('sender').order_by('created_at')
    return JsonResponse({'product':{'id':p.id,'title':p.title},'other':{'id':other.id,'username':other.username},'messages':[{'id':m.id,'sender':m.sender.username,'mine':m.sender_id==request.user.id,'message':m.message,'created_at':m.created_at.strftime('%d %b %Y, %I:%M %p')} for m in qs]})


@login_required
@require_http_methods(['GET'])
def mobile_admin_dashboard(request):
    if not _admin(request.user): return JsonResponse({'error':'Admin access required.'},status=403)
    return JsonResponse({
        'users':User.objects.count(),'members':User.objects.filter(is_member=True).count(),'tasks':Task.objects.count(),
        'pending_task_submissions':TaskCompletion.objects.filter(status='pending').count(),
        'campaigns':AdminCampaign.objects.count(),'pending_campaign_submissions':CampaignSubmission.objects.filter(status='pending').count(),
        'pending_withdrawals':request.user._meta.apps.get_model('accounts','WithdrawalRequest').objects.filter(status='pending').count(),
    })


@login_required
@require_http_methods(['GET'])
def mobile_admin_campaigns(request):
    if not _admin(request.user): return JsonResponse({'error':'Admin access required.'},status=403)
    qs=AdminCampaign.objects.select_related('created_by').order_by('-created_at')
    return JsonResponse({'campaigns':[{'id':c.id,'title':c.title,'description':c.description,'reward':str(c.reward),'platform':c.platform,'max_participants':c.max_participants,'participants':c.participants,'status':c.status,'start_date':str(c.start_date),'end_date':str(c.end_date),'image':_img(request,c.image)} for c in qs]})


@login_required
@require_http_methods(['GET'])
def mobile_admin_campaign_submissions(request):
    if not _admin(request.user): return JsonResponse({'error':'Admin access required.'},status=403)
    status=(request.GET.get('status') or 'pending').lower()
    qs=CampaignSubmission.objects.select_related('campaign','user').order_by('-created_at')
    if status in {'pending','approved','rejected'}: qs=qs.filter(status=status)
    return JsonResponse({'submissions':[{'id':s.id,'campaign':s.campaign.title,'campaign_id':s.campaign_id,'username':s.user.username,'video_link':s.video_link,'screenshot':_img(request,s.screenshot),'status':s.status,'rejection_reason':s.rejection_reason,'created_at':s.created_at.strftime('%d %b %Y, %I:%M %p')} for s in qs]})


@login_required
@require_http_methods(['GET'])
def mobile_feature_manifest(request):
    nigeria=(request.user.country or '').strip().lower() in {'nigeria','ng','nga'}
    uk=(request.user.country or '').strip().lower() in {'uk','gb','gbr','united kingdom','great britain','england','scotland','wales','northern ireland'}
    return JsonResponse({
        'country':request.user.country,'is_nigeria':nigeria,'is_uk':uk,'is_admin':_admin(request.user),
        'marketplace':nigeria or uk,'membership_price':'5.00' if nigeria else '10.00',
        'funding_methods':['flutterwave'] if nigeria else ['card','apple_pay','bank_transfer'],
        'withdrawal_methods':['nigeria_bank'] if nigeria else ['paypal'],
        'features':['dashboard','earn_tasks','campaigns','post_task','my_posted_tasks','task_reviews','approved_tasks','wallet','funding','withdrawals','membership','referrals','notifications','transactions','profiles','following','search','recent_activity','marketplace','sell','edit_listing','mark_sold','delete_listing','cart','checkout','messages','profile_edit','password','support','about','legal'] + (['admin_dashboard','admin_campaigns','admin_campaign_reviews'] if _admin(request.user) else [])
    })


@login_required
@require_http_methods(['POST'])
def mobile_market_checkout(request):
    if not _is_market_country(request.user):
        return JsonResponse({'error':'Marketplace unavailable in your country.'}, status=403)
    try:
        data=json.loads(request.body or '{}')
        ids=[int(x) for x in (data.get('product_ids') or [])]
    except Exception:
        ids=[]
    products=list(Product.objects.filter(id__in=ids,is_sold=False).exclude(seller=request.user))
    if not products:
        return JsonResponse({'error':'Your cart is empty.'}, status=400)
    stripe.api_key=settings.STRIPE_SECRET_KEY
    line_items=[]
    for p in products:
        line_items.append({'price_data':{'currency':'gbp','product_data':{'name':p.title},'unit_amount':int(p.price*100)},'quantity':1})
    site_url=settings.SITE_URL.rstrip('/')
    session=stripe.checkout.Session.create(
        payment_method_types=['card'], mode='payment', customer_email=request.user.email or None,
        line_items=line_items,
        metadata={'user_id':str(request.user.id),'purpose':'marketplace_cart','product_ids':','.join(str(p.id) for p in products)},
        success_url=f'{site_url}/cart/?checkout=success', cancel_url=f'{site_url}/cart/?checkout=cancelled',
    )
    return JsonResponse({'checkout_url':session.url})


@login_required
@require_http_methods(['POST'])
def mobile_admin_campaign_action(request, submission_id, action):
    if not _admin(request.user): return JsonResponse({'error':'Admin access required.'},status=403)
    s=get_object_or_404(CampaignSubmission.objects.select_related('campaign','user'),id=submission_id)
    if action=='approve':
        if s.status!='pending': return JsonResponse({'error':'Only pending submissions can be approved.'},status=400)
        c=s.campaign
        if c.participants>=c.max_participants: return JsonResponse({'error':'Campaign is full.'},status=400)
        s.status='approved'; s.reviewed_at=timezone.now(); s.rejection_reason=''; s.save(update_fields=['status','reviewed_at','rejection_reason'])
        c.participants+=1; c.save(update_fields=['participants'])
        u=s.user; u.balance+=c.reward; u.earnings+=c.reward; u.tasks_completed+=1; u.save(update_fields=['balance','earnings','tasks_completed'])
        Notification.objects.create(user=u,title='Campaign approved',message=f"Your submission for '{c.title}' was approved. £{c.reward} has been added to your wallet.")
        RecentActivity.objects.create(username=u.username,platform=c.platform,message=f'@{u.username} earned £{c.reward} from a SQUEEB campaign',amount=c.reward)
        return JsonResponse({'success':True,'message':'Campaign submission approved and paid.'})
    if action=='reject':
        if s.status!='pending': return JsonResponse({'error':'Only pending submissions can be rejected.'},status=400)
        try: data=json.loads(request.body or '{}')
        except Exception: data={}
        reason=(data.get('rejection_reason') or '').strip()
        if not reason: return JsonResponse({'error':'Enter a rejection reason.'},status=400)
        s.status='rejected'; s.reviewed_at=timezone.now(); s.rejection_reason=reason; s.save(update_fields=['status','reviewed_at','rejection_reason'])
        Notification.objects.create(user=s.user,title='Campaign rejected',message=f"Your submission for '{s.campaign.title}' was rejected. Reason: {reason}")
        return JsonResponse({'success':True,'message':'Campaign submission rejected.'})
    return JsonResponse({'error':'Invalid action.'},status=400)


@require_http_methods(['GET'])
def mobile_content_page(request, slug):
    templates={
        'about':'accounts/home/about.html','support':'accounts/support.html','terms':'accounts/legal/terms.html',
        'privacy':'accounts/legal/privacy.html','refund':'accounts/legal/refund.html','cookies':'accounts/legal/cookies.html',
        'acceptable-use':'accounts/legal/acceptable_use.html','influencer-terms':'accounts/influencer_terms.html',
    }
    template=templates.get(slug)
    if not template: return JsonResponse({'error':'Page not found.'},status=404)
    html=render_to_string(template,{},request=request)
    text=' '.join(strip_tags(html).split())
    return JsonResponse({'slug':slug,'content':text})
