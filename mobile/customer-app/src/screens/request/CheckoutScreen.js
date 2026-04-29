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
    <View key={item.id} className="flex-row justify-between items-center py-2 border-b" style={{ borderBottomColor: theme.colors.border }}>
      <View className="flex-1">
        <Text className="text-sm font-medium mb-1" style={{ color: theme.colors.text.primary }}>{item.name}</Text>
        <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>Qty: {item.quantity}</Text>
      </View>
      <Text className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>₦{(Number(item.basePrice) * item.quantity).toLocaleString()}</Text>
    </View>
  );

  const renderAddressCard = () => {
    if (selectedAddress) {
      return (
        <TouchableOpacity className="flex-row items-center bg-white rounded-xl p-4 border" style={{ borderColor: theme.colors.border }} onPress={handleAddressSelect}>
          <Ionicons name="location" size={20} color={theme.colors.primary} />
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold mb-1" style={{ color: theme.colors.text.primary }}>{selectedAddress.label || 'Selected Address'}</Text>
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }} numberOfLines={1}>
              {selectedAddress.address}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity className="flex-row items-center justify-center bg-white rounded-xl p-4 border border-dashed" style={{ borderColor: theme.colors.border }} onPress={handleAddressSelect}>
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
        <Text className="text-sm font-medium ml-2" style={{ color: theme.colors.primary }}>Add Delivery Address</Text>
      </TouchableOpacity>
    );
  };

  const renderPaymentMethod = (method) => {
    const isSelected = paymentMethod === method.id;
    return (
      <TouchableOpacity
        key={method.id}
        className={`flex-row items-center bg-white rounded-xl p-4 mb-2 border ${isSelected ? 'border-orange-600' : 'border-gray-200'}`}
        style={{ backgroundColor: isSelected ? theme.colors.primary + '10' : undefined }}
        onPress={() => setPaymentMethod(method.id)}
      >
        <Ionicons
          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={isSelected ? theme.colors.primary : theme.colors.text.secondary}
        />
        <Text className={`flex-1 ml-3 text-sm ${isSelected ? 'font-semibold' : ''}`} style={{ color: theme.colors.text.primary }}>
          {method.label}
        </Text>
        {method.id === 'wallet' && (
          <Text className="text-sm font-semibold" style={{ color: theme.colors.primary }}>₦{Number(balance).toLocaleString()}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isCreating) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="mt-4 text-base" style={{ color: theme.colors.text.secondary }}>Placing your order...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }} edges={['top']}>
      <View className="flex-row items-center px-4 py-4 bg-white border-b" style={{ borderBottomColor: theme.colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-center" style={{ color: theme.colors.text.primary }}>Checkout</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Order Summary</Text>
          <View className="bg-white rounded-xl p-3">
            {cart.map(renderCartItem)}
          </View>
        </View>

        {/* Delivery Address */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Delivery Address</Text>
          {renderAddressCard()}
        </View>

        {/* Payment Method */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Payment Method</Text>
          {renderPaymentMethod({ id: 'wallet', label: 'Wallet Balance' })}
          {renderPaymentMethod({ id: 'card', label: 'Card (Coming Soon)' })}
          {renderPaymentMethod({ id: 'cash', label: 'Cash on Delivery' })}
        </View>

        {/* Special Instructions */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Special Instructions</Text>
          <TextInput
            className="bg-white rounded-xl p-4 text-sm border"
            style={{ color: theme.colors.text.primary, borderColor: theme.colors.border }}
            placeholder="Add any special requests (optional)"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Cost Breakdown */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Cost Breakdown</Text>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Subtotal</Text>
            <Text className="text-sm" style={{ color: theme.colors.text.primary }}>₦{subtotal.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Delivery Fee</Text>
            <Text className="text-sm" style={{ color: theme.colors.text.primary }}>₦{DELIVERY_FEE.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Platform Fee</Text>
            <Text className="text-sm" style={{ color: theme.colors.text.primary }}>₦{PLATFORM_FEE.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between py-3 border-t mt-1" style={{ borderTopColor: theme.colors.border }}>
            <Text className="text-base font-semibold" style={{ color: theme.colors.text.primary }}>Total</Text>
            <Text className="text-base font-bold" style={{ color: theme.colors.primary }}>₦{total.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="bg-white px-4 py-4 border-t" style={{ borderTopColor: theme.colors.border }}>
        <TouchableOpacity className="bg-orange-600 py-4 rounded-xl items-center" onPress={handlePlaceOrder}>
          <Text className="text-base font-bold text-white">Place Order - ₦{total.toLocaleString()}</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <View className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View className="bg-white rounded-2xl p-6 w-[80%] max-w-[320px]">
            <Text className="text-lg font-bold mb-3 text-center" style={{ color: theme.colors.text.primary }}>Confirm Order</Text>
            <Text className="text-sm mb-6 text-center" style={{ color: theme.colors.text.secondary }}>
              Are you sure you want to place this order for ₦{total.toLocaleString()}?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg items-center bg-gray-200"
                onPress={() => setShowConfirmModal(false)}
              >
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 py-3 rounded-lg items-center bg-orange-600" onPress={confirmOrder}>
                <Text className="text-sm font-semibold text-white">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
