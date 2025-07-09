const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create sample stores
  const balladBlossomStore = await prisma.store.upsert({
    where: { website: 'https://ballardblossom.com' },
    update: {},
    create: {
      name: 'Ballard Blossom',
      website: 'https://ballardblossom.com',
      storeType: 'FLOWER_SHOP',
      address: '5465 Leary Ave NW',
      city: 'Seattle',
      state: 'WA',
      zip: '98107',
      latitude: 47.6684,
      longitude: -122.3827,
      phone: '(206) 297-1500',
      rating: 4.8,
      deliveryFee: 15.0,
      minDelivery: 50.0,
      maxDelivery: 200.0,
      deliveryRadius: 15,
      scrapingInfo: {
        create: {
          baseUrl: 'https://ballardblossom.com',
          productSelectors: JSON.stringify(['.product-item', '.product-card']),
          priceSelectors: JSON.stringify(['.price', '.product-price']),
          titleSelectors: JSON.stringify(['.product-title', 'h3']),
          imageSelectors: JSON.stringify(['.product-image img', 'img']),
          scrapingFrequency: 24,
          isActive: true
        }
      }
    }
  });

  const terraBellaStore = await prisma.store.upsert({
    where: { website: 'https://terrabellaflowers.com' },
    update: {},
    create: {
      name: 'Terra Bella Flowers',
      website: 'https://terrabellaflowers.com',
      storeType: 'FLOWER_SHOP',
      address: '4405 Wallingford Ave N',
      city: 'Seattle',
      state: 'WA',
      zip: '98103',
      latitude: 47.6615,
      longitude: -122.3341,
      phone: '(206) 632-8702',
      rating: 4.9,
      deliveryFee: 12.0,
      minDelivery: 40.0,
      maxDelivery: 175.0,
      deliveryRadius: 12,
      scrapingInfo: {
        create: {
          baseUrl: 'https://terrabellaflowers.com',
          productSelectors: JSON.stringify(['.product-item', '.product-tile']),
          priceSelectors: JSON.stringify(['.price', '.amount']),
          titleSelectors: JSON.stringify(['.product-name', 'h2', 'h3']),
          imageSelectors: JSON.stringify(['.product-img img', '.image img']),
          scrapingFrequency: 24,
          isActive: true
        }
      }
    }
  });

  // Create sample liquor store
  const totalWineStore = await prisma.store.upsert({
    where: { website: 'https://totalwine.com' },
    update: {},
    create: {
      name: 'Total Wine & More',
      website: 'https://totalwine.com',
      storeType: 'LIQUOR_STORE',
      address: '140 4th Ave N',
      city: 'Seattle',
      state: 'WA',
      zip: '98109',
      latitude: 47.6205,
      longitude: -122.3493,
      phone: '(206) 282-0808',
      rating: 4.5,
      deliveryFee: 9.99,
      minDelivery: 35.0,
      maxDelivery: 500.0,
      deliveryRadius: 20,
      scrapingInfo: {
        create: {
          baseUrl: 'https://totalwine.com',
          productSelectors: JSON.stringify(['.plp-product-tile', '.product-item']),
          priceSelectors: JSON.stringify(['.price', '.plp-product-price']),
          titleSelectors: JSON.stringify(['.plp-product-title', '.product-name']),
          imageSelectors: JSON.stringify(['.plp-product-image img', '.product-image img']),
          scrapingFrequency: 12,
          isActive: true
        }
      }
    }
  });

  // Create sample products for Ballard Blossom
  await prisma.product.createMany({
    data: [
      {
        storeId: balladBlossomStore.id,
        title: 'Red Rose Bouquet - Dozen',
        description: 'A classic dozen red roses arranged beautifully',
        price: 89.99,
        originalPrice: 99.99,
        image: 'https://example.com/red-roses.jpg',
        url: 'https://ballardblossom.com/red-roses-dozen',
        category: 'FLOWERS',
        subcategory: 'Roses',
        brand: 'Ballard Blossom',
        size: 'Dozen',
        inStock: true
      },
      {
        storeId: balladBlossomStore.id,
        title: 'Mixed Spring Bouquet',
        description: 'Seasonal mixed flowers in bright spring colors',
        price: 65.00,
        image: 'https://example.com/spring-mix.jpg',
        url: 'https://ballardblossom.com/spring-bouquet',
        category: 'FLOWERS',
        subcategory: 'Mixed',
        brand: 'Ballard Blossom',
        size: 'Medium',
        inStock: true
      }
    ]
  });

  // Create sample products for Total Wine
  await prisma.product.createMany({
    data: [
      {
        storeId: totalWineStore.id,
        title: 'Titos Handmade Vodka 750ml',
        description: 'Premium gluten-free vodka from Austin, Texas',
        price: 24.99,
        image: 'https://example.com/titos-vodka.jpg',
        url: 'https://totalwine.com/titos-vodka-750ml',
        category: 'SPIRITS',
        subcategory: 'Vodka',
        brand: 'Titos',
        size: '750ml',
        abv: 40.0,
        inStock: true
      },
      {
        storeId: totalWineStore.id,
        title: 'Titos Handmade Vodka 1.75L',
        description: 'Premium gluten-free vodka from Austin, Texas - Large bottle',
        price: 42.99,
        image: 'https://example.com/titos-vodka-large.jpg',
        url: 'https://totalwine.com/titos-vodka-1750ml',
        category: 'SPIRITS',
        subcategory: 'Vodka',
        brand: 'Titos',
        size: '1.75L',
        abv: 40.0,
        inStock: true
      }
    ]
  });

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@doai.com' },
    update: {},
    create: {
      email: 'test@doai.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-123-4567',
      addresses: {
        create: [
          {
            label: 'Home',
            firstName: 'Test',
            lastName: 'User',
            address1: '123 Main St',
            address2: 'Apt 4B',
            city: 'Seattle',
            state: 'WA',
            zip: '98101',
            phone: '555-123-4567',
            isDefault: true,
            latitude: 47.6062,
            longitude: -122.3321
          },
          {
            label: 'Work',
            firstName: 'Test',
            lastName: 'User',
            address1: '456 Business Ave',
            city: 'Seattle',
            state: 'WA',
            zip: '98102',
            phone: '555-123-4567',
            isDefault: false,
            latitude: 47.6205,
            longitude: -122.3493
          }
        ]
      },
      preferences: {
        create: {
          deliveryRadius: 15,
          priceWeight: 0.4,
          distanceWeight: 0.3,
          ratingWeight: 0.3,
          preferDelivery: true,
          preferPickup: true
        }
      }
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log(`Created stores: ${balladBlossomStore.name}, ${terraBellaStore.name}, ${totalWineStore.name}`);
  console.log(`Created test user: ${testUser.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });