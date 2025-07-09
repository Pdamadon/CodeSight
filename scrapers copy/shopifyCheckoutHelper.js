// shopifyCheckoutHelper.js
module.exports = async function fillShopifyCheckout(page, {
  email,
  firstName,
  lastName,
  address1,
  address2,
  city,
  zip,
  country,
  province,
  phone
}) {
  try {
    console.log('[✏️] Filling Shopify checkout form...');

    await page.fill('input[name="checkout[email]"]', email);
    await page.fill('input[name="checkout[shipping_address][first_name]"]', firstName);
    await page.fill('input[name="checkout[shipping_address][last_name]"]', lastName);
    await page.fill('input[name="checkout[shipping_address][address1]"]', address1);
    if (address2) {
      await page.fill('input[name="checkout[shipping_address][address2]"]', address2);
    }
    await page.fill('input[name="checkout[shipping_address][city]"]', city);
    await page.fill('input[name="checkout[shipping_address][zip]"]', zip);
    await page.selectOption('select[name="checkout[shipping_address][country]"]', { label: country });
    await page.selectOption('select[name="checkout[shipping_address][province]"]', { label: province });
    if (phone) {
      await page.fill('input[name="checkout[shipping_address][phone]"]', phone);
    }

    console.log('[✅] Shopify checkout form filled successfully');
  } catch (err) {
    console.error('❌ Failed to fill Shopify checkout form:', err.message);
  }
};