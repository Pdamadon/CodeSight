const express = require('express');
const { createUser, loginUser, authenticateToken } = require('../lib/auth');
const { prisma } = require('../lib/database');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, firstName, lastName, phone, password } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Email, first name, and last name are required' 
      });
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await createUser({
      email: email.toLowerCase(),
      firstName,
      lastName,
      phone,
      password
    });

    res.status(201).json({
      message: 'User created successfully',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message === 'User already exists with this email') {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser(email.toLowerCase(), password);

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message === 'User not found' || error.message === 'Invalid password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' }
        },
        preferences: true,
        orders: {
          include: {
            store: true,
            orderItems: {
              include: {
                product: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Last 10 orders
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone })
      },
      include: {
        addresses: true,
        preferences: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { 
      deliveryRadius, 
      priceWeight, 
      distanceWeight, 
      ratingWeight,
      preferDelivery,
      preferPickup
    } = req.body;

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user.id },
      update: {
        ...(deliveryRadius !== undefined && { deliveryRadius }),
        ...(priceWeight !== undefined && { priceWeight }),
        ...(distanceWeight !== undefined && { distanceWeight }),
        ...(ratingWeight !== undefined && { ratingWeight }),
        ...(preferDelivery !== undefined && { preferDelivery }),
        ...(preferPickup !== undefined && { preferPickup })
      },
      create: {
        userId: req.user.id,
        deliveryRadius: deliveryRadius || 10,
        priceWeight: priceWeight || 0.4,
        distanceWeight: distanceWeight || 0.3,
        ratingWeight: ratingWeight || 0.3,
        preferDelivery: preferDelivery !== undefined ? preferDelivery : true,
        preferPickup: preferPickup !== undefined ? preferPickup : true
      }
    });

    res.json({
      message: 'Preferences updated successfully',
      preferences
    });

  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;