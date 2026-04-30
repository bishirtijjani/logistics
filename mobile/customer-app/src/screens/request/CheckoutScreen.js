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
  const { cart, merchantId, type } = route.params;
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
        merchantId,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          description: item.description,
          unitPrice: Number(item.basePrice),
          quantity: item.quantity,
          totalPrice: Number(item.basePrice) * item.quantity,
        })),
        pickupAddress: 'Merchant Location',
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
    <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 4, color: theme.colors.text.primary }}>{item.name}</Text>
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>Qty: {item.quantity}</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }}>₦{(Number(item.basePrice) * item.quantity).toLocaleString()}</Text>
    </View>
  );

  const renderAddressCard = () => {
    if (selectedAddress) {
      return (
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border }} onPress={handleAddressSelect}>
          <Ionicons name="location" size={20} color={theme.colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4, color: theme.colors.text.primary }}>{selectedAddress.label || 'Selected Address'}</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary }} numberOfLines={1}>
              {selectedAddress.address}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border }} onPress={handleAddressSelect}>
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '500', marginLeft: 8, color: theme.colors.primary }}>Add Delivery Address</Text>
      </TouchableOpacity>
    );
  };

  const renderPaymentMethod = (method) => {
    const isSelected = paymentMethod === method.id;
    return (
      <TouchableOpacity
        key={method.id}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: isSelected ? '#EA580C' : '#E5E7EB', backgroundColor: isSelected ? theme.colors.primary + '10' : '#fff' }}
        onPress={() => setPaymentMethod(method.id)}
      >
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.text.secondary}
        />
        <Text style={{ flex: 1, marginLeft: 12, fontSize: 14, fontWeight: isSelected ? '600' : '400', color: theme.colors.text.primary }}>
          {method.label}
        </Text>
        {method.id === 'wallet' && (
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }}>₦{Number(balance).toLocaleString()}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isCreating) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: theme.colors.text.secondary }}>Placing your order...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center', color: theme.colors.text.primary }}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Order Summary</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
            {cart.map(renderCartItem)}
          </View>
        </View>

        {/* Delivery Address */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Delivery Address</Text>
          {renderAddressCard()}
        </View>

        {/* Payment Method */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Payment Method</Text>
          {renderPaymentMethod({ id: 'wallet', label: 'Wallet Balance' })}
          {renderPaymentMethod({ id: 'card', label: 'Card (Coming Soon)' })}
          {renderPaymentMethod({ id: 'cash', label: 'Cash on Delivery' })}
        </View>

        {/* Special Instructions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Special Instructions</Text>
          <TextInput
            style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 14, borderWidth: 1, color: theme.colors.text.primary, borderColor: theme.colors.border }}
            placeholder="Add any special requests (optional)"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Cost Breakdown */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Cost Breakdown</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Subtotal</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text.primary }}>₦{subtotal.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Delivery Fee</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text.primary }}>₦{DELIVERY_FEE.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Platform Fee</Text>
            <Text style={{ fontSize: 14, color: theme.colors.text.primary }}>₦{PLATFORM_FEE.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, marginTop: 4, borderTopColor: theme.colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.primary }}>₦{total.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
        <TouchableOpacity style={{ backgroundColor: '#EA580C', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }} onPress={handlePlaceOrder}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Place Order - ₦{total.toLocaleString()}</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%', maxWidth: 320 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: theme.colors.text.primary }}>Confirm Order</Text>
            <Text style={{ fontSize: 14, marginBottom: 24, textAlign: 'center', color: theme.colors.text.secondary }}>
              Are you sure you want to place this order for ₦{total.toLocaleString()}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#E5E7EB' }}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#EA580C' }} onPress={confirmOrder}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
