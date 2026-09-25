/* Plus 4 Performance — shop product data.
   Single source of truth for /shop (grid) and /shop/product.html (detail template).
   price: null means "Coming soon" instead of a price on the grid and product page.
   stripePaymentLink: "REPLACE_WITH_LINK" is a placeholder, swap in the real
   Stripe Payment Link per product before launch. Until it's swapped, the product
   page shows a disabled "Coming soon" button instead of "Buy Now". */
window.P4P_PRODUCTS = [
  {
    name: 'Plus Four Tee',
    slug: 'plus-four-tee',
    category: 'tees',
    price: 20,
    description: 'Regular fit tee. Small PLUS FOUR on the chest, big Plus 4 print on the back.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/logo-tee-black-front.jpg', '/images/shop/logo-tee-black-back.jpg'] },
      { name: 'Navy', swatch: '#1f2a44', images: ['/images/shop/logo-tee-navy-front.jpg', '/images/shop/logo-tee-navy-back.jpg'] },
      { name: 'Charcoal', swatch: '#55585c', images: ['/images/shop/logo-tee-charcoal-front.jpg', '/images/shop/logo-tee-charcoal-back.jpg'] },
      { name: 'Brown', swatch: '#5a3a2a', images: ['/images/shop/logo-tee-brown-front.jpg', '/images/shop/logo-tee-brown-back.jpg'] },
      { name: 'Burgundy', swatch: '#7a1c28', images: ['/images/shop/logo-tee-burgundy-front.jpg', '/images/shop/logo-tee-burgundy-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Heavyweight Tee',
    slug: 'plus-four-heavyweight-tee',
    category: 'tees',
    price: 25,
    description: 'Heavyweight oversized tee. Boxy fit, made to be trained in.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/boxy-tee-black-front.jpg', '/images/shop/boxy-tee-black-back.jpg'] },
      { name: 'Sage', swatch: '#8b8b74', images: ['/images/shop/boxy-tee-sage-front.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Hoodie',
    slug: 'plus-four-hoodie',
    category: 'hoodies',
    price: 35,
    description: 'Heavyweight oversized hoodie. PLUS FOUR on the chest, full Plus 4 print on the back.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/logo-hoodie-black-front.jpg', '/images/shop/logo-hoodie-black-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Piped Hoodie',
    slug: 'piped-hoodie',
    category: 'hoodies',
    price: 35,
    description: 'Oversized hoodie with reflective piping and zip side pockets.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/piped-hoodie-black-front.jpg', '/images/shop/piped-hoodie-black-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Piped Joggers',
    slug: 'piped-joggers',
    category: 'joggers',
    price: 35,
    description: 'Relaxed barrel-leg joggers with reflective piping. Pairs with the Piped Hoodie.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/piped-joggers-black-front.jpg', '/images/shop/piped-joggers-black-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Camo Joggers',
    slug: 'camo-joggers',
    category: 'joggers',
    price: 35,
    description: 'Relaxed barrel-leg joggers in tree camo.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Tree Camo', swatch: '#5c5a3f', images: ['/images/shop/camo-joggers-front.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  }
];
