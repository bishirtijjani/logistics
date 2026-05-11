/**
 * MerchantMenuScreen — View merchant menu/products and place orders
 * Part of the unified request architecture
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import theme, { colors } from '../../theme';

const MerchantMenuScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { merchantId, categorySlug } = route.params;

  const [merchant, setMerchant] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMerchantDetails = async () => {
    try {
      const response = await api.get(`/merchants/${merchantId}`);
      const data = response?.data || {};
      setMerchant(data);
      setProducts(data.products || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to load menu',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantDetails();
  }, [merchantId]);

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(
      cart.map((item) => {
        if (item.id === productId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + Number(item.basePrice) * item.quantity, 0);
  };

  const renderProduct = ({ item }) => {
    const cartItem = cart.find((c) => c.id === item.id);
    return (
      <View style={styles.productCard}>
        <Image
          source={{ uri: item.imageUrl || 'https://via.placeholder.com/100' }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.productPrice}>₦{Number(item.basePrice).toLocaleString()}</Text>
        </View>
        {cartItem ? (
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, -1)}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{cartItem.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.id, 1)}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => addToCart(item)}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCategoryHeader = ({ title }) => (
    <Text style={styles.categoryHeader}>{title}</Text>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="restaurant-outline" size={64} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>Menu not available</Text>
      <Text style={styles.emptySubtitle}>This merchant hasn't added any items yet</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Merchant Header */}
        <Image
          source={{ uri: merchant?.coverImageUrl || 'https://via.placeholder.com/400x200' }}
          style={styles.coverImage}
        />
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.merchantHeader}>
            <Image
              source={{ uri: merchant?.logoUrl || 'https://via.placeholder.com/50' }}
              style={styles.logo}
            />
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>{merchant?.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color="#FFA500" />
                <Text style={styles.rating}>{merchant?.averageRating?.toFixed(1)}</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.address}>{merchant?.address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Products */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Menu</Text>
          {products.length === 0 ? (
            renderEmpty()
          ) : (
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartCount}>{cart.length} item{cart.length > 1 ? 's' : ''}</Text>
            <Text style={styles.cartTotal}>₦{getCartTotal().toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => navigation.navigate('Checkout', {
              cart,
              merchantId,
              categorySlug,
              pickupLat: merchant?.lat || 0,
              pickupLng: merchant?.lng || 0,
              pickupAddress: merchant?.address || 'Merchant Location',
            })}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  headerContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginBottom: 8,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 4,
  },
  separator: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 8,
  },
  address: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  menuContainer: {
    padding: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  categoryHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    borderRadius: 8,
  },
  quantityButton: {
    padding: 8,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 8,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  cartFooter: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartInfo: {
    flex: 1,
  },
  cartCount: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  cartTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  checkoutButtonTextDisabled: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
};

export default MerchantMenuScreen;
