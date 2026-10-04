/* Plus 4 Performance — size guide data.
   Single source of truth for shop/product.html's size guide modal and
   size-guide.html. Loaded as a plain <script> (same pattern as
   js/products.js) and assigns window.P4P_SIZE_GUIDES.
   Keyed by product slug (the same id used throughout js/products.js,
   js/basket.js and shop/product.html). A product with no entry here
   gets no size guide button/section — nothing else needs to change.
   All measurements copied as-is from the supplier charts — do not
   round or alter them here. */
(function(){
  var FLAT_MEASURE_NOTE = 'All measurements are taken flat across the garment, not all the way round. Allow 1-3 cm variance.';

  var HOW_TO_MEASURE = {
    top: [
      { label: 'Length', text: 'From where the shoulder seam meets the collar down to the hem.' },
      { label: 'Shoulder', text: 'Seam to seam across the back.' },
      { label: 'Chest', text: 'Flat across, underarm to underarm.' },
      { label: 'Sleeve', text: 'From the shoulder seam to the cuff.' }
    ],
    bottom: [
      { label: 'Length', text: 'Waistband to hem.' },
      { label: 'Waist', text: 'Flat across the waistband (elasticated).' },
      { label: 'Hip', text: 'Flat across the widest point.' }
    ]
  };

  var TOP_COLUMNS = ['Length', 'Shoulder', 'Chest', 'Sleeve'];
  var BOTTOM_COLUMNS = ['Length', 'Waist', 'Hip'];

  var HOODIE_ROWS = [
    { size: 'S', cm: [70, 65, 66, 53.5], in: [27.56, 25.59, 25.98, 21.06] },
    { size: 'M', cm: [72, 67, 68, 54.5], in: [28.35, 26.38, 26.77, 21.46] },
    { size: 'L', cm: [74, 69, 70, 55.5], in: [29.13, 27.17, 27.56, 21.85] },
    { size: 'XL', cm: [76, 71, 72, 56.5], in: [29.92, 27.95, 28.35, 22.24] },
    { size: 'XXL', cm: [78, 73, 74, 57.5], in: [30.71, 28.74, 29.13, 22.64] }
  ];

  var SIZE_GUIDES = {
    // Heavyweight Tee
    'plus-four-heavyweight-tee': {
      type: 'top',
      columns: TOP_COLUMNS,
      rows: [
        { size: 'S', cm: [70, 54, 56, 23], in: [27.56, 21.26, 22.05, 9.06] },
        { size: 'M', cm: [72, 56, 58, 24], in: [28.35, 22.05, 22.83, 9.45] },
        { size: 'L', cm: [74, 58, 60, 25], in: [29.13, 22.83, 23.62, 9.84] },
        { size: 'XL', cm: [76, 60, 62, 26], in: [29.92, 23.62, 24.41, 10.24] },
        { size: 'XXL', cm: [78, 62, 64, 27], in: [30.71, 24.41, 25.20, 10.63] }
      ]
    },
    // Plus Four Tee
    'plus-four-tee': {
      type: 'top',
      columns: TOP_COLUMNS,
      rows: [
        { size: 'S', cm: [67.5, 48, 50, 21.5], in: [26.57, 18.90, 19.68, 8.46] },
        { size: 'M', cm: [69.5, 50.5, 52.5, 22], in: [27.36, 19.88, 20.67, 8.66] },
        { size: 'L', cm: [72, 53, 55, 22.5], in: [28.35, 20.87, 21.65, 8.86] },
        { size: 'XL', cm: [74.5, 55.5, 57.5, 23], in: [29.33, 21.85, 22.64, 9.06] },
        { size: 'XXL', cm: [76.5, 58, 60, 23.5], in: [30.12, 22.83, 23.62, 9.25] },
        { size: 'XXXL', cm: [78, 60.5, 62.5, 24], in: [30.71, 23.82, 24.61, 9.45] }
      ]
    },
    // Hoodie and Piped Hoodie share the same supplier chart
    'plus-four-hoodie': { type: 'top', columns: TOP_COLUMNS, rows: HOODIE_ROWS },
    'piped-hoodie': { type: 'top', columns: TOP_COLUMNS, rows: HOODIE_ROWS },
    // Zip Hoodie
    'plus-four-zip-hoodie': {
      type: 'top',
      columns: TOP_COLUMNS,
      rows: [
        { size: 'S', cm: [68, 61, 61, 54.5], in: [26.77, 24.02, 24.02, 21.46] },
        { size: 'M', cm: [70, 63, 63, 55.5], in: [27.56, 24.80, 24.80, 21.85] },
        { size: 'L', cm: [72, 65, 65, 56.5], in: [28.35, 25.59, 25.59, 22.24] },
        { size: 'XL', cm: [74, 67, 67, 57.5], in: [29.13, 26.38, 26.38, 22.64] },
        { size: 'XXL', cm: [76, 69, 69, 58.5], in: [29.92, 27.17, 27.17, 23.03] }
      ]
    },
    // Crewneck
    'plus-four-crewneck': {
      type: 'top',
      columns: TOP_COLUMNS,
      rows: [
        { size: 'S', cm: [68, 61, 60, 51], in: [26.77, 24.02, 23.62, 20.08] },
        { size: 'M', cm: [70, 63, 62, 52], in: [27.56, 24.80, 24.41, 20.47] },
        { size: 'L', cm: [72, 65, 64, 53], in: [28.35, 25.59, 25.20, 20.87] },
        { size: 'XL', cm: [74, 67, 66, 54], in: [29.13, 26.38, 25.98, 21.26] },
        { size: 'XXL', cm: [76, 69, 68, 55], in: [29.92, 27.17, 26.77, 21.65] }
      ]
    },
    // Shorts
    'plus-four-shorts': {
      type: 'bottom',
      columns: BOTTOM_COLUMNS,
      rows: [
        { size: 'S', cm: [41, 35.5, 54], in: [16.14, 13.98, 21.26] },
        { size: 'M', cm: [42, 37.5, 57], in: [16.54, 14.76, 22.44] },
        { size: 'L', cm: [43, 39.5, 60], in: [16.93, 15.55, 23.62] },
        { size: 'XL', cm: [44, 42.5, 64], in: [17.32, 16.73, 25.20] },
        { size: 'XXL', cm: [45, 45.5, 68], in: [17.72, 17.91, 26.77] }
      ]
    },
    // Piped Joggers
    'piped-joggers': {
      type: 'bottom',
      columns: BOTTOM_COLUMNS,
      rows: [
        { size: 'S', cm: [101, 35, 60], in: [39.76, 13.78, 23.62] },
        { size: 'M', cm: [103, 37, 62], in: [40.55, 14.57, 24.41] },
        { size: 'L', cm: [105, 39, 64], in: [41.34, 15.35, 25.20] },
        { size: 'XL', cm: [107, 41, 66], in: [42.13, 16.14, 25.98] },
        { size: 'XXL', cm: [109, 43, 68], in: [42.91, 16.93, 26.77] }
      ]
    },
    // Camo Joggers
    'camo-joggers': {
      type: 'bottom',
      columns: BOTTOM_COLUMNS,
      rows: [
        { size: 'S', cm: [102, 34, 53], in: [40.16, 13.39, 20.87] },
        { size: 'M', cm: [104, 36, 55], in: [40.94, 14.17, 21.65] },
        { size: 'L', cm: [106, 38, 57], in: [41.73, 14.96, 22.44] },
        { size: 'XL', cm: [108, 40, 59], in: [42.52, 15.75, 23.23] },
        { size: 'XXL', cm: [110, 42, 61], in: [43.31, 16.54, 24.02] }
      ]
    }
  };

  /* ---------- shared render helpers (used by size-guide.html and
     shop/product.html's size guide modal, so the markup stays identical
     in both places) ---------- */

  function filterRows(entry, productSizes){
    if(!productSizes) return entry.rows;
    return entry.rows.filter(function(row){ return productSizes.indexOf(row.size) !== -1; });
  }

  function tableHTML(entry, unit, productSizes){
    var u = unit === 'in' ? 'in' : 'cm';
    var rows = filterRows(entry, productSizes);
    var headCells = '<th>Size</th>' + entry.columns.map(function(col){
      return '<th>' + col + ' (' + u + ')</th>';
    }).join('');
    var bodyRows = rows.map(function(row){
      var values = row[u];
      // Inch values are always given to 2 decimal places in the supplier
      // chart (e.g. 25.20) — toFixed keeps that exact formatting, since a
      // bare JS number literal drops the trailing zero (25.20 -> 25.2).
      return '<tr><td>' + row.size + '</td>' + values.map(function(v){
        return '<td>' + (u === 'in' ? v.toFixed(2) : v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="size-guide-table"><thead><tr>' + headCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table>';
  }

  function howToMeasureHTML(type){
    var items = HOW_TO_MEASURE[type] || [];
    return '<ul class="size-guide-how-list">' + items.map(function(item){
      return '<li><strong>' + item.label + ':</strong> ' + item.text + '</li>';
    }).join('') + '</ul>';
  }

  window.P4P_SIZE_GUIDES = SIZE_GUIDES;
  window.P4P_SIZE_GUIDE_NOTE = FLAT_MEASURE_NOTE;
  window.P4P_SIZE_GUIDE_HOW_TO_MEASURE = HOW_TO_MEASURE;
  window.P4P_SIZE_GUIDE_HELPERS = {
    filterRows: filterRows,
    tableHTML: tableHTML,
    howToMeasureHTML: howToMeasureHTML
  };
})();
