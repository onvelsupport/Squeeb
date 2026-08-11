from decimal import Decimal, InvalidOperation

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import Product, ProductImage

ALLOWED_MARKETPLACE_COUNTRIES = {
    'uk', 'gb', 'gbr', 'united kingdom', 'great britain',
    'england', 'scotland', 'wales', 'northern ireland',
    'nigeria', 'ng', 'nga',
}


def _allowed(user):
    return (user.country or '').strip().lower() in ALLOWED_MARKETPLACE_COUNTRIES


def _media_url(request, field):
    if not field:
        return ''
    try:
        return request.build_absolute_uri(field.url)
    except Exception:
        return ''


def _serialize(request, product):
    extras = list(product.images.all())
    gallery = []
    if product.image:
        gallery.append({'id': 'main', 'url': _media_url(request, product.image), 'is_main': True})
    gallery.extend({'id': x.id, 'url': _media_url(request, x.image), 'is_main': False} for x in extras if x.image)
    primary = gallery[0]['url'] if gallery else ''
    return {
        'id': product.id,
        'title': product.title,
        'price': str(product.price),
        'description': product.description,
        'category': product.category,
        'seller': product.seller.username,
        'seller_id': product.seller_id,
        'is_mine': product.seller_id == request.user.id,
        'is_sold': product.is_sold,
        'image': primary,
        'images': gallery,
        'created_at': product.created_at.strftime('%d %b %Y'),
    }


def _unavailable(request):
    return JsonResponse({
        'available': False,
        'country': request.user.country,
        'message': 'SQUEEB Market is currently available in the United Kingdom and Nigeria.',
    }, status=403)


@login_required
@require_http_methods(['GET'])
def mobile_marketplace_list(request):
    if not _allowed(request.user):
        return JsonResponse({'products': [], 'available': False, 'country': request.user.country})
    products = Product.objects.filter(is_sold=False).select_related('seller').prefetch_related('images').order_by('-created_at')
    return JsonResponse({'available': True, 'products': [_serialize(request, p) for p in products]})


@login_required
@require_http_methods(['GET'])
def mobile_marketplace_mine(request):
    if not _allowed(request.user):
        return _unavailable(request)
    products = Product.objects.filter(seller=request.user).select_related('seller').prefetch_related('images').order_by('-created_at')
    return JsonResponse({'available': True, 'products': [_serialize(request, p) for p in products]})


def _validate_listing(request, product=None):
    title = (request.POST.get('title') or (product.title if product else '')).strip()
    description = (request.POST.get('description') or (product.description if product else '')).strip()
    category = (request.POST.get('category') or (product.category if product else '')).strip()
    raw_price = (request.POST.get('price') or (str(product.price) if product else '')).strip()
    if not title or not description or not category or not raw_price:
        return None, JsonResponse({'error': 'Title, price, category and description are required.'}, status=400)
    if len(title) > 200:
        return None, JsonResponse({'error': 'Product title must be 200 characters or fewer.'}, status=400)
    if len(description) > 1000:
        return None, JsonResponse({'error': 'Description must be 1000 characters or fewer.'}, status=400)
    try:
        price = Decimal(raw_price)
        if price <= 0:
            raise InvalidOperation
    except Exception:
        return None, JsonResponse({'error': 'Enter a valid price.'}, status=400)
    return (title, description, category, price), None


@login_required
@require_http_methods(['POST'])
def mobile_marketplace_sell(request):
    if not _allowed(request.user):
        return _unavailable(request)
    values, error = _validate_listing(request)
    if error:
        return error
    title, description, category, price = values
    files = request.FILES.getlist('images')
    if not files:
        return JsonResponse({'error': 'Add at least one product photo.'}, status=400)
    if len(files) > 10:
        return JsonResponse({'error': 'You can upload up to 10 photos per listing.'}, status=400)
    product = Product.objects.create(
        seller=request.user,
        title=title,
        price=price,
        description=description,
        category=category,
        image=files[0],
    )
    # Keep the main photo in Product.image and store additional photos only once.
    for f in files[1:]:
        ProductImage.objects.create(product=product, image=f)
    product = Product.objects.select_related('seller').prefetch_related('images').get(pk=product.pk)
    return JsonResponse({'message': 'Listing created.', 'product': _serialize(request, product)}, status=201)


@login_required
@require_http_methods(['POST'])
def mobile_marketplace_update(request, product_id):
    if not _allowed(request.user):
        return _unavailable(request)
    product = get_object_or_404(Product.objects.prefetch_related('images'), id=product_id, seller=request.user)
    values, error = _validate_listing(request, product)
    if error:
        return error
    title, description, category, price = values
    product.title, product.description, product.category, product.price = title, description, category, price
    if 'is_sold' in request.POST:
        product.is_sold = str(request.POST.get('is_sold')).lower() in {'1','true','on','yes'}

    remove_ids = {int(x) for x in (request.POST.get('remove_image_ids') or '').split(',') if x.strip().isdigit()}
    if remove_ids:
        for row in product.images.filter(id__in=remove_ids):
            try:
                if row.image: row.image.delete(save=False)
            except Exception:
                pass
            row.delete()

    if request.POST.get('remove_main_image') == '1' and product.image:
        try: product.image.delete(save=False)
        except Exception: pass
        product.image = ''

    replacement_main = request.FILES.get('crop_main_image')
    if replacement_main:
        try:
            if product.image: product.image.delete(save=False)
        except Exception:
            pass
        product.image = replacement_main

    # Match the website's ability to replace a cropped existing image.
    for row in list(product.images.all()):
        replacement = request.FILES.get(f'crop_existing_{row.id}')
        if replacement:
            try:
                if row.image: row.image.delete(save=False)
            except Exception:
                pass
            row.image = replacement
            row.save(update_fields=['image'])

    files = request.FILES.getlist('images')
    if files:
        if not product.image:
            product.image = files[0]
            files = files[1:]
        for f in files:
            ProductImage.objects.create(product=product, image=f)

    product.save()
    product = Product.objects.select_related('seller').prefetch_related('images').get(pk=product.pk)
    return JsonResponse({'message': 'Listing updated.', 'product': _serialize(request, product)})


@login_required
@require_http_methods(['POST'])
def mobile_marketplace_sold(request, product_id):
    if not _allowed(request.user):
        return _unavailable(request)
    product = get_object_or_404(Product, id=product_id, seller=request.user)
    product.is_sold = True
    product.save(update_fields=['is_sold'])
    return JsonResponse({'message': 'Listing marked as sold.'})


@login_required
@require_http_methods(['DELETE', 'POST'])
def mobile_marketplace_delete(request, product_id):
    if not _allowed(request.user):
        return _unavailable(request)
    product = get_object_or_404(Product, id=product_id, seller=request.user)
    product.delete()
    return JsonResponse({'message': 'Listing deleted.'})
