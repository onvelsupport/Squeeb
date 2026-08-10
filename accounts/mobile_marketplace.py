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


def _image_url(request, product):
    if product.image:
        try:
            return request.build_absolute_uri(product.image.url)
        except Exception:
            pass
    extra = product.images.first()
    if extra and extra.image:
        return request.build_absolute_uri(extra.image.url)
    return ''


def _serialize(request, product):
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
        'image': _image_url(request, product),
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
    products = Product.objects.filter(seller=request.user).prefetch_related('images').order_by('-created_at')
    return JsonResponse({'available': True, 'products': [_serialize(request, p) for p in products]})


@login_required
@require_http_methods(['POST'])
def mobile_marketplace_sell(request):
    if not _allowed(request.user):
        return _unavailable(request)
    title = (request.POST.get('title') or '').strip()
    description = (request.POST.get('description') or '').strip()
    category = (request.POST.get('category') or '').strip()
    raw_price = (request.POST.get('price') or '').strip()
    if not title or not description or not category or not raw_price:
        return JsonResponse({'error': 'Title, price, category and description are required.'}, status=400)
    try:
        price = Decimal(raw_price)
        if price <= 0:
            raise InvalidOperation
    except Exception:
        return JsonResponse({'error': 'Enter a valid price.'}, status=400)

    files = request.FILES.getlist('images')
    product = Product.objects.create(
        seller=request.user,
        title=title,
        price=price,
        description=description,
        category=category,
        image=files[0] if files else '',
    )
    for f in files:
        ProductImage.objects.create(product=product, image=f)
    return JsonResponse({'message': 'Listing created.', 'product': _serialize(request, product)}, status=201)


@login_required
@require_http_methods(['POST'])
def mobile_marketplace_update(request, product_id):
    if not _allowed(request.user):
        return _unavailable(request)
    product = get_object_or_404(Product, id=product_id, seller=request.user)
    title = (request.POST.get('title') or product.title).strip()
    description = (request.POST.get('description') or product.description).strip()
    category = (request.POST.get('category') or product.category).strip()
    raw_price = (request.POST.get('price') or str(product.price)).strip()
    try:
        price = Decimal(raw_price)
        if price <= 0:
            raise InvalidOperation
    except Exception:
        return JsonResponse({'error': 'Enter a valid price.'}, status=400)
    product.title, product.description, product.category, product.price = title, description, category, price
    files = request.FILES.getlist('images')
    if files:
        product.image = files[0]
        for f in files:
            ProductImage.objects.create(product=product, image=f)
    product.save()
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
