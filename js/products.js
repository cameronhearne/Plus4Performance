/* Plus 4 Performance — shop product data.
   Single source of truth for the browser (/shop grid, /shop/product.html,
   basket) AND for server-side price/catalogue validation in
   netlify/functions/create-checkout-session.js. Loaded as a plain <script>
   in the browser (assigns window.P4P_PRODUCTS) and via require() in
   Netlify Functions (module.exports) — same array either way.
   price: null means "Coming soon" instead of a price on the grid and product page.
   isTee: true flags the products that qualify for the single-tee delivery rate
   (see calculateDelivery in create-checkout-session.js and js/basket.js) —
   kept as an explicit field rather than matching on category/name so delivery
   logic doesn't silently break if a product is renamed or recategorised. */
(function(){
var P4P_PRODUCTS = [
  {
    name: 'Plus Four Tee',
    slug: 'plus-four-tee',
    category: 'tees',
    isTee: true,
    price: 20,
    description: 'Regular fit tee. Small PLUS FOUR on the chest, big Plus 4 print on the back.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/tee-black-front.jpg', '/images/shop/tee-black-back.jpg'] },
      { name: 'Navy', swatch: '#1f2a44', images: ['/images/shop/tee-navy-front.jpg', '/images/shop/tee-navy-back.jpg'] },
      { name: 'Coffee', swatch: '#4a3528', images: ['/images/shop/tee-coffee-front.jpg', '/images/shop/tee-coffee-back.jpg'] },
      { name: 'Dark Grey', swatch: '#4a4a4a', images: ['/images/shop/tee-dark-grey-front.jpg', '/images/shop/tee-dark-grey-back.jpg'] },
      { name: 'Wine Red', swatch: '#5e1420', images: ['/images/shop/tee-wine-red-front.jpg', '/images/shop/tee-wine-red-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Heavyweight Tee',
    slug: 'plus-four-heavyweight-tee',
    category: 'tees',
    isTee: true,
    price: 25,
    description: 'Heavyweight oversized tee. Boxy fit, made to be trained in.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/boxy-tee-black-front.jpg', '/images/shop/boxy-tee-black-back.jpg'] },
      { name: 'Sage', swatch: '#8b8b74', images: ['/images/shop/boxy-tee-sage-front.jpg', '/images/shop/boxy-tee-sage-back.jpg'] },
      { name: 'Coffee', swatch: '#5a3a28', images: ['/images/shop/boxy-tee-coffee-front.jpg', '/images/shop/boxy-tee-coffee-back.jpg'] },
      { name: 'Green', swatch: '#2f4a33', images: ['/images/shop/boxy-tee-green-front.jpg', '/images/shop/boxy-tee-green-back.jpg'] },
      { name: 'Apricot', swatch: '#e8b88a', light: true, images: ['/images/shop/boxy-tee-apricot-front.jpg', '/images/shop/boxy-tee-apricot-back.jpg'] }
    ],
    stripePaymentLink: 'REPLACE_WITH_LINK'
  },
  {
    name: 'Plus Four Hoodie',
    slug: 'plus-four-hoodie',
    category: 'hoodies',
    price: 30,
    description: 'Heavyweight oversized hoodie. PLUS FOUR on the chest, full Plus 4 print on the back.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/hoodie-black-front.jpg', '/images/shop/hoodie-black-back.jpg'] },
      { name: 'Navy', swatch: '#26344a', images: ['/images/shop/hoodie-navy-front.jpg', '/images/shop/hoodie-navy-back.jpg'] },
      { name: 'Grey', swatch: '#9a9a9a', light: true, images: ['/images/shop/hoodie-grey-front.jpg', '/images/shop/hoodie-grey-back.jpg'] },
      { name: 'Brown', swatch: '#5a4a40', images: ['/images/shop/hoodie-brown-front.jpg', '/images/shop/hoodie-brown-back.jpg'] },
      { name: 'Sage', swatch: '#8b8b74', images: ['/images/shop/hoodie-sage-front.jpg', '/images/shop/hoodie-sage-back.jpg'] }
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
      { name: 'Grey', swatch: '#9a9a9a', light: true, images: ['/images/shop/zip-hoodie-grey-front.jpg', '/images/shop/zip-hoodie-grey-back.jpg'] },
      { name: 'Oat', swatch: '#ece8dc', light: true, images: ['/images/shop/zip-hoodie-oat-front.jpg', '/images/shop/zip-hoodie-oat-back.jpg'] }
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
      { name: 'Black', swatch: '#111111', images: ['/images/shop/piped-hoodie-black-front.jpg', '/images/shop/piped-hoodie-black-back.jpg'] },
      { name: 'Navy', swatch: '#26344a', images: ['/images/shop/piped-hoodie-navy-front.jpg', '/images/shop/piped-hoodie-navy-back.jpg'] },
      { name: 'Medium Grey', swatch: '#8a8a8a', light: true, images: ['/images/shop/piped-hoodie-grey-front.jpg', '/images/shop/piped-hoodie-grey-back.jpg'] }
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
  },
  {
    name: 'Plus Four Shorts',
    slug: 'plus-four-shorts',
    category: 'shorts',
    price: 25,
    description: 'Training shorts. Vertical PLUS FOUR on the left leg, small 4 mark on the back.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colours: [
      { name: 'Black', swatch: '#111111', images: ['/images/shop/shorts-black-front.jpg', '/images/shop/shorts-black-back.jpg'] },
      { name: 'Teal', swatch: '#1f6b63', images: ['/images/shop/shorts-teal-front.jpg', '/images/shop/shorts-teal-back.jpg'] },
      { name: 'Pale Khaki', swatch: '#c9bfa0', light: true, images: ['/images/shop/shorts-pale-khaki-front.jpg', '/images/shop/shorts-pale-khaki-back.jpg'] }
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
