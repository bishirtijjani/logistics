/**
 * MerchantBrowseScreen — Browse merchants (restaurants, grocery stores, pharmacies)
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
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import theme from '../../theme';

const MerchantBrowseScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { type, lat, lng } = route.params;

  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMerchants = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      if (lat && lng) {
        params.append('lat', lat);
        params.append('lng', lng);
        params.append('radius', '10');
      }
      params.append('openNow', 'true');

      const response = await api.get(`/api/merchants?${params.toString()}`);
      setMerchants(response.data.data);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to load merchants',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [type, lat, lng]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMerchants();
  };

  const getTypeLabel = (type) => {
    const labels = {
      FOOD: 'Restaurants',
      GROCERY: 'Grocery Stores',
      PHARMACY: 'Pharmacies',
    };
    return labels[type] || type;
  };

  const renderMerchant = ({ item }) => (
    <TouchableOpacity
      style={styles.merchantCard}
      onPress={() => navigation.navigate('MerchantMenu', { merchantId: item.id, type })}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.coverImageUrl || 'https://via.placeholder.com/400x200' }}
        style={styles.coverImage}
      />
      <View style={styles.merchantInfo}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: item.logoUrl || 'https://via.placeholder.com/50' }}
            style={styles.logo}
          />
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFA500" />
              <Text style={styles.rating}>{item.averageRating.toFixed(1)}</Text>
              <Text style={styles.orderCount}>({item.totalOrders} orders)</Text>
            </View>
          </View>
          {item.isOpen ? (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>Open</Text>
            </View>
          ) : (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {item.address}
        </Text>
        <View style={styles.footerRow}>
          <Text style={styles.type}>{item.type}</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="storefront-outline" size={64} color={theme.colors.text.secondary} />
      <Text style={styles.emptyTitle}>No {getTypeLabel(type).toLowerCase()} found</Text>
      <Text style={styles.emptySubtitle}>
        Try changing your location or check back later
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTypeLabel(type)}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={merchants}
        renderItem={renderMerchant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      />
    </View>
  );
};

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  merchantCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  coverImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  merchantInfo: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginLeft: 4,
  },
  orderCount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginLeft: 4,
  },
  openBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  openText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  closedBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  address: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  type: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
};

export default MerchantBrowseScreen;
