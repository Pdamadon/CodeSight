const express = require('express');
const { authenticateToken } = require('../lib/auth');
const { prisma } = require('../lib/database');

const router = express.Router();

// Get user addresses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { isDefault: 'desc' }
    });

    res.json({ addresses });

  } catch (error) {
    console.error('Addresses fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// Add new address
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      label,
      firstName,
      lastName,
      address1,
      address2,
      city,
      state,
      zip,
      phone,
      isDefault
    } = req.body;

    // Validate required fields
    if (!label || !firstName || !lastName || !address1 || !city || !state || !zip) {
      return res.status(400).json({
        error: 'Label, first name, last name, address, city, state, and zip are required'
      });
    }

    // If this is being set as default, unset current default
    if (isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId: req.user.id,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: req.user.id,
        label,
        firstName,
        lastName,
        address1,
        address2,
        city,
        state,
        zip,
        phone,
        isDefault: isDefault || false
      }
    });

    res.status(201).json({
      message: 'Address added successfully',
      address
    });

  } catch (error) {
    console.error('Address creation error:', error);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// Update address
router.put('/:addressId', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;
    const {
      label,
      firstName,
      lastName,
      address1,
      address2,
      city,
      state,
      zip,
      phone,
      isDefault
    } = req.body;

    // Verify address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id
      }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If this is being set as default, unset current default
    if (isDefault && !existingAddress.isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId: req.user.id,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: {
        ...(label && { label }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(address1 && { address1 }),
        ...(address2 !== undefined && { address2 }),
        ...(city && { city }),
        ...(state && { state }),
        ...(zip && { zip }),
        ...(phone !== undefined && { phone }),
        ...(isDefault !== undefined && { isDefault })
      }
    });

    res.json({
      message: 'Address updated successfully',
      address: updatedAddress
    });

  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// Delete address
router.delete('/:addressId', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;

    // Verify address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id
      }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Don't allow deletion of default address if it's the only one
    if (existingAddress.isDefault) {
      const addressCount = await prisma.address.count({
        where: { userId: req.user.id }
      });

      if (addressCount === 1) {
        return res.status(400).json({ 
          error: 'Cannot delete the only address. Please add another address first.' 
        });
      }

      // If deleting default address, make another one default
      const otherAddress = await prisma.address.findFirst({
        where: { 
          userId: req.user.id,
          id: { not: addressId }
        }
      });

      if (otherAddress) {
        await prisma.address.update({
          where: { id: otherAddress.id },
          data: { isDefault: true }
        });
      }
    }

    await prisma.address.delete({
      where: { id: addressId }
    });

    res.json({ message: 'Address deleted successfully' });

  } catch (error) {
    console.error('Address deletion error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// Set default address
router.put('/:addressId/default', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;

    // Verify address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id
      }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Unset current default
    await prisma.address.updateMany({
      where: { 
        userId: req.user.id,
        isDefault: true
      },
      data: { isDefault: false }
    });

    // Set new default
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true }
    });

    res.json({
      message: 'Default address updated successfully',
      address: updatedAddress
    });

  } catch (error) {
    console.error('Default address update error:', error);
    res.status(500).json({ error: 'Failed to update default address' });
  }
});

module.exports = router;