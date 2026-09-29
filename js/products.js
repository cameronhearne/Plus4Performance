/* Plus 4 Performance — shop product data.
   Single source of truth for the browser (/shop grid, /shop/product.html,
   basket) AND for server-side price/catalogue validation in
   netlify/functions/create-checkout-session.js. Loaded as a plain <script>
   in the browser (assigns window.P4P_PRODUCTS) and via require() in
   Netlify Functions (module.exports) — same array either way.
   price: null means "Coming soon" instead of a price on the grid and product page. */
(function(){
var P4P_PRODUCTS = [
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
      { name: 'Black', swatch: '#111111', images: ['/images/shop/hoodie-black-front.jpg', '/images/shop/hoodie-black-back.jpg'] },
      { name: 'Navy', swatch: '#26344a', images: ['/images/shop/hoodie-navy-front.jpg', '/images/shop/hoodie-navy-back.jpg'] },
      { name: 'Eden Green', swatch: '#1f5c3f', images: ['/images/shop/hoodie-eden-green-front.jpg', '/images/shop/hoodie-eden-green-back.jpg'] },
      { name: 'Plum', swatch: '#4a2238', images: ['/images/shop/hoodie-plum-front.jpg', '/images/shop/hoodie-plum-back.jpg'] },
      { name: 'Dark Brown', swatch: '#5a4a40', images: ['/images/shop/hoodie-dark-brown-front.jpg', '/images/shop/hoodie-dark-brown-back.jpg'] },
      { name: 'Grey Coffee', swatch: '#8a8670', images: ['/images/shop/hoodie-grey-coffee-front.jpg', '/images/shop/hoodie-grey-coffee-back.jpg'] },
      { name: 'Oat', swatch: '#ece8dc', light: true, images: ['/images/shop/hoodie-oat-front.jpg', '/images/shop/hoodie-oat-back.jpg'] },
      { name: 'Grey Marl', swatch: '#c9c9c9', light: true, images: ['/images/shop/hoodie-grey-marl-front.jpg', '/images/shop/hoodie-grey-marl-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Zip Hoodie',
    slug: 'plus-four-zip-hoodie',
    category: 'hoodies',
    price: 40,
    description: 'Oversized zip hoodie with a double-ended zip. Vertical PLUS FOUR print on the chest.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/zip-hoodie-black-front.jpg', '/images/shop/zip-hoodie-black-back.jpg'] },
      { name: 'Navy', swatch: '#26344a', images: ['/images/shop/zip-hoodie-navy-front.jpg', '/images/shop/zip-hoodie-navy-back.jpg'] },
      { name: 'Oat', swatch: '#ece8dc', light: true, images: ['/images/shop/zip-hoodie-oat-front.jpg', '/images/shop/zip-hoodie-oat-back.jpg'] },
      { name: 'Grey Marl', swatch: '#c9c9c9', light: true, images: ['/images/shop/zip-hoodie-grey-marl-front.jpg', '/images/shop/zip-hoodie-grey-marl-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Crewneck',
    slug: 'plus-four-crewneck',
    category: 'crewnecks',
    price: 30,
    description: 'Boxy, cropped fleece crewneck. PLUS FOUR on the chest.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/crewneck-black-front.jpg', '/images/shop/crewneck-black-back.jpg'] },
      { name: 'Grey Marl', swatch: '#c9c9c9', light: true, images: ['/images/shop/crewneck-grey-marl-front.jpg', '/images/shop/crewneck-grey-marl-back.jpg'] }
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
      { name: 'Tree Camo', swatch: '#5c5a3f', images: ['/images/shop/camo-joggers-front.jpg', '/images/shop/camo-joggers-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  }
];
if(typeof module !== 'undefined' && module.exports){
  module.exports = P4P_PRODUCTS;
}
if(typeof window !== 'undefined'){
  window.P4P_PRODUCTS = P4P_PRODUCTS;
}
})();
