/**
 * CheckoutScreen — Unified request checkout flow
 * Handles cart review, address selection, payment, and order confirmation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import theme from '../../theme';
import { createRequest } from '../../store/slices/requestSlice';
import { fetchWallet } from '../../store/slices/walletSlice';

const DELIVERY_FEE = 500;
const PLATFORM_FEE = 100;

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { cart, providerId, type } = route.params;
  const { balance } = useSelector((state) => state.wallet);
  const { user } = useSelector((state) => state.auth);
  const { isCreating } = useSelector((state) => state.request);

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + Number(item.basePrice) * item.quantity, 0);
  const total = subtotal + DELIVERY_FEE + PLATFORM_FEE;

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  const handleAddressSelect = () => {
    navigation.navigate('SavedAddresses', {
      onSelect: (address) => {
        setSelectedAddress(address);
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Toast.show({
        type: 'error',
        text1: 'Address Required',
        text2: 'Please select a delivery address',
      });
      return;
    }

    if (paymentMethod === 'wallet' && Number(balance) < total) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `You need ₦${total.toLocaleString()} but have ₦${Number(balance).toLocaleString()}`,
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmOrder = async () => {
    setShowConfirmModal(false);

    try {
      const requestData = {
        type,
        providerId,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          description: item.description,
          unitPrice: Number(item.basePrice),
          quantity: item.quantity,
          totalPrice: Number(item.basePrice) * item.quantity,
        })),
        pickupAddress: 'Provider Location',
        pickupLat: 0,
        pickupLng: 0,
        dropoffAddress: selectedAddress.address,
        dropoffLat: selectedAddress.lat || 0,
        dropoffLng: selectedAddress.lng || 0,
        dropoffName: selectedAddress.label || 'Home',
        subtotal,
        deliveryFee: DELIVERY_FEE,
        platformFee: PLATFORM_FEE,
        total,
        specialInstructions,
      };

      const result = await dispatch(createRequest(requestData)).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Order Placed!',
        text2: 'Your order has been placed successfully',
      });

      navigation.navigate('RequestTracking', { requestId: result.id });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: error.message || 'Failed to place order. Please try again.',
      });
    }
  };

  const renderCartItem = (item) => (
    <View key={item.id} style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>₦{(Number(item.basePrice) * item.quantity).toLocaleString()}</Text>
    </View>
  );

  const renderAddressCard = () => {
    if (selectedAddress) {
      return (
        <TouchableOpacity style={styles.addressCard} onPress={handleAddressSelect}>
          <Ionicons name="location" size={20} color={theme.colors.primary} />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>{selectedAddress.label || 'Selected Address'}</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {selectedAddress.address}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.addressCardEmpty} onPress={handleAddressSelect}>
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
        <Text style={styles.addAddressText}>Add Delivery Address</Text>
      </TouchableOpacity>
    );
  };

  const renderPaymentMethod = (method) => {
    const isSelected = paymentMethod === method.id;
    return (
      <TouchableOpacity
        key={method.id}
        style={[styles.paymentMethod, isSelected && styles.paymentMethodSelected]}
        onPress={() => setPaymentMethod(method.id)}
      >
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.text.secondary}
        />
        <Text style={[styles.paymentMethodText, isSelected && styles.paymentMethodTextSelected]}>
          {method.label}
        </Text>
        {method.id === 'wallet' && (
          <Text style={styles.walletBalance}>₦{Number(balance).toLocaleString()}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isCreating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Placing your order...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.cartItems}>
            {cart.map(renderCartItem)}
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {renderAddressCard()}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {renderPaymentMethod({ id: 'wallet', label: 'Wallet Balance' })}
          {renderPaymentMethod({ id: 'card', label: 'Card (Coming Soon)' })}
          {renderPaymentMethod({ id: 'cash', label: 'Cash on Delivery' })}
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder="Add any special requests (optional)"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Cost Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Subtotal</Text>
            <Text style={styles.costValue}>₦{subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Delivery Fee</Text>
            <Text style={styles.costValue}>₦{DELIVERY_FEE.toLocaleString()}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Platform Fee</Text>
            <Text style={styles.costValue}>₦{PLATFORM_FEE.toLocaleString()}</Text>
          </View>
          <View style={[styles.costRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.placeOrderButton} onPress={handlePlaceOrder}>
          <Text style={styles.placeOrderButtonText}>Place Order - ₦{total.toLocaleString()}</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Order</Text>
            <Text style={styles.modalText}>
              Are you sure you want to place this order for ₦{total.toLocaleString()}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={confirmOrder}>
                <Text style={styles.modalButtonConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  cartItems: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addressCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addressInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
    marginLeft: 8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  paymentMethodSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  paymentMethodText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  paymentMethodTextSelected: {
    fontWeight: '600',
  },
  walletBalance: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  instructionsInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlignVertical: 'top',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  costLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  costValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  footer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  placeOrderButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeOrderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
};
