const express = require('express');
const { authenticateToken, optionalAuth } = require('../lib/auth');
const { prisma } = require('../lib/database');

const router = express.Router();

// Get user orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        store: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalOrders = await prisma.order.count({
      where: { userId: req.user.id }
    });

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalOrders,
        pages: Math.ceil(totalOrders / limit)
      }
    });

  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get specific order
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: req.user.id
      },
      include: {
        store: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });

  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create new order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      storeId,
      addressId,
      userRequest,
      deliveryType,
      deliveryDate,
      cardMessage,
      orderItems // Array of { productId, quantity, variant?, price }
    } = req.body;

    // Validate required fields
    if (!storeId || !addressId || !userRequest || !orderItems || orderItems.length === 0) {
      return res.status(400).json({
        error: 'Store, address, user request, and order items are required'
      });
    }

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Calculate total amount
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of orderItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(404).json({ 
          error: `Product ${item.productId} not found` 
        });
      }

      if (product.storeId !== storeId) {
        return res.status(400).json({ 
          error: `Product ${item.productId} does not belong to the selected store` 
        });
      }

      const itemTotal = (item.price || product.price) * (item.quantity || 1);
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity || 1,
        price: item.price || product.price,
        variant: item.variant
      });
    }

    // Add delivery fee if applicable
    const deliveryFee = store.deliveryFee || 0;
    if (deliveryType === 'DELIVERY') {
      totalAmount += deliveryFee;
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        storeId,
        addressId,
        userRequest,
        totalAmount,
        deliveryFee: deliveryType === 'DELIVERY' ? deliveryFee : null,
        deliveryType: deliveryType || 'DELIVERY',
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        cardMessage,
        orderItems: {
          create: validatedItems
        }
      },
      include: {
        store: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Order created successfully',
      order
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status (for store owners or admin)
router.put('/:orderId/status', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, orderNumber } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: req.user.id
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(orderNumber && { orderNumber })
      },
      include: {
        store: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Cancel order
router.put('/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: req.user.id
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only allow cancellation of pending or confirmed orders
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Order cannot be cancelled in its current status' 
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: {
        store: true,
        address: true,
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Order cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;