const { buildCheckoutCart } = require('./cartBuilder');

(async () => {
  const url = await buildCheckoutCart({
    productUrl: 'https://www.terrabellaflowers.com/products/citrus',
    variantName: 'Modest',
    zipCode: '98101',
    cardMessage: 'Happy Birthday!',
    deliveryDateLabel: 'Thu, 03 July, 2025'
  });

  console.log('➡️ Final checkout URL:', url);
})();