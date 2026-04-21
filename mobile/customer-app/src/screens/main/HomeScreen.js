import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { fetchWallet } from "../../store/slices/walletSlice";
import { hydrateLocation } from "../../store/slices/locationSlice";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";
import Toast from "react-native-toast-message";

// SKIN A — Bold Lagos

const coreServices = [
  {
    id: "1",
    name: "Food",
    icon: "hamburger",
    color: "#EA580C",
    bg: "#FFF0E8",
    type: "FontAwesome5",
  },
  {
    id: "2",
    name: "Delivery",
    icon: "moped",
    color: "#2563EB",
    bg: "#EFF6FF",
    type: "MaterialCommunityIcons",
  },
  {
    id: "3",
    name: "Pharmacy",
    icon: "pill",
    color: "#059669",
    bg: "#ECFDF5",
    type: "MaterialCommunityIcons",
  },
  {
    id: "4",
    name: "Groceries",
    icon: "basket",
    color: "#7C3AED",
    bg: "#F5F3FF",
    type: "MaterialCommunityIcons",
  },
];

const vtuServices = [
  {
    id: "v1",
    name: "Airtime",
    icon: "phone-portrait-outline",
    color: "#EA580C",
    type: "Ionicons",
  },
  {
    id: "v2",
    name: "Data",
    icon: "wifi-outline",
    color: "#2563EB",
    type: "Ionicons",
  },
  {
    id: "v3",
    name: "Electricity",
    icon: "flash-outline",
    color: "#D97706",
    type: "Ionicons",
  },
  {
    id: "v4",
    name: "Transfer",
    icon: "swap-horizontal-outline",
    color: "#059669",
    type: "Ionicons",
  },
];

function resolveIcon(item) {
  if (item.type === "MaterialCommunityIcons") return MaterialCommunityIcons;
  if (item.type === "FontAwesome5") return FontAwesome5;
  return Ionicons;
}

function formatNaira(amount) {
  return (
    "\u20A6" +
    Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const { balance } = useSelector((state) => state.wallet);
  const { city, isLoaded: locationLoaded } = useSelector(
    (state) => state.location,
  );
  const dispatch = useDispatch();
  const [showBalance, setShowBalance] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchWallet());
    dispatch(hydrateLocation());
  }, [dispatch]);

  const locationLabel = city ? `${city}, Nigeria` : "Katsina, Nigeria";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FAFAFA" }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <View style={{ height: 4, backgroundColor: "#EA580C" }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("LocationPicker")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: "#09090b",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginBottom: 18,
            }}
          >
            <Ionicons name="location" size={14} color="#EA580C" />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: "#fff",
                marginLeft: 5,
                marginRight: 4,
              }}
            >
              {locationLabel}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#6B7280" />
          </TouchableOpacity>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 12,
                  color: "#6B7280",
                  fontWeight: "600",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Hello, {user?.firstName || "there"}
              </Text>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "900",
                  color: "#09090b",
                  marginTop: 4,
                  letterSpacing: -1.2,
                  lineHeight: 36,
                }}
              >
                What do you{"\n"}need today?
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("ProfileTab")}
              style={{
                width: 46,
                height: 46,
                backgroundColor: "#09090b",
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
              }}
            >
              <Ionicons name="person" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={{
            marginHorizontal: 20,
            marginTop: 16,
            backgroundColor: "#fff",
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: "#E5E7EB",
          }}
        >
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 14,
              marginLeft: 10,
              fontWeight: "500",
            }}
          >
            Search food, services, items...
          </Text>
        </TouchableOpacity>

        {/* Wallet Pill */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          style={{
            marginHorizontal: 20,
            marginTop: 18,
            backgroundColor: "#09090b",
            borderRadius: 18,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: "#09090b",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#ffffff15",
                padding: 10,
                borderRadius: 12,
                marginRight: 12,
              }}
            >
              <Ionicons name="wallet" size={20} color="#E5E7EB" />
            </View>
            <View>
              <Text
                style={{
                  color: "#6B7280",
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                Available Balance
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              >
                {showBalance
                  ? formatNaira(balance)
                  : "\u20A6 \u2022\u2022\u2022\u2022"}
              </Text>
            </View>
          </View>
          <View
            style={{
              backgroundColor: "#EA580C",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "800",
                marginRight: 4,
              }}
            >
              View
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Core Services */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                fontSize: 19,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
              }}
            >
              Services
            </Text>
            <View
              style={{
                width: 30,
                height: 3.5,
                backgroundColor: "#EA580C",
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {coreServices.map((item) => {
              const Icon = resolveIcon(item);
              const handlePress = () => {
                if (item.name === "Delivery") {
                  navigation.navigate("CreateDelivery");
                } else if (item.name === "Food" || item.name === "Pharmacy" || item.name === "Groceries") {
                  // Coming soon toast
                  Toast.show({
                    type: "info",
                    text1: "Coming Soon",
                    text2: `${item.name} ordering will be available soon!`,
                  });
                }
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={handlePress}
                  style={{ width: "23%", alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 62,
                      height: 62,
                      backgroundColor: item.bg,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                      borderWidth: 1.5,
                      borderColor: item.color + "25",
                    }}
                  >
                    <Icon name={item.icon} size={26} color={item.color} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#09090b",
                      textAlign: "center",
                    }}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bills & Utilities */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                fontSize: 19,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
              }}
            >
              Bills & Utilities
            </Text>
            <View
              style={{
                width: 30,
                height: 3.5,
                backgroundColor: "#EA580C",
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {vtuServices.map((item) => {
              const Icon = resolveIcon(item);
              const handlePress = () => {
                if (item.name === "Airtime") {
                  navigation.navigate("Airtime");
                } else if (item.name === "Data") {
                  navigation.navigate("Data");
                } else if (item.name === "Electricity") {
                  Toast.show({
                    type: "info",
                    text1: "Coming Soon",
                    text2: "Electricity payments will be available soon!",
                  });
                } else if (item.name === "Transfer") {
                  Toast.show({
                    type: "info",
                    text1: "Coming Soon",
                    text2: "P2P transfers will be available soon!",
                  });
                }
              };
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={handlePress}
                  style={{ width: "23%", alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 62,
                      height: 62,
                      backgroundColor: "#09090b",
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Icon name={item.icon} size={24} color={item.color} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#09090b",
                      textAlign: "center",
                    }}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Promo Banner */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 32,
            backgroundColor: "#09090b",
            borderRadius: 22,
            padding: 22,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -24,
              top: -24,
              width: 110,
              height: 110,
              backgroundColor: "#EA580C18",
              borderRadius: 55,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 48,
              bottom: -32,
              width: 80,
              height: 80,
              backgroundColor: "#EA580C10",
              borderRadius: 40,
            }}
          />
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: "#EA580C",
                  borderRadius: 3,
                  marginRight: 6,
                }}
              />
              <Text
                style={{
                  color: "#EA580C",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                First Order
              </Text>
            </View>
            <Text
              style={{
                color: "#fff",
                fontSize: 22,
                fontWeight: "900",
                letterSpacing: -0.5,
                lineHeight: 27,
              }}
            >
              Free Delivery{"\n"}Today Only
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("CreateDelivery")}
            style={{
              backgroundColor: "#EA580C",
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 13,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
              Order
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text
            style={{
              fontSize: 19,
              fontWeight: "900",
              color: "#09090b",
              letterSpacing: -0.5,
              marginBottom: 14,
            }}
          >
            Recent Activity
          </Text>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 18,
              borderWidth: 1.5,
              borderColor: "#E5E7EB",
              alignItems: "center",
              paddingVertical: 30,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                backgroundColor: "#F3F4F6",
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Ionicons name="time-outline" size={24} color="#6B7280" />
            </View>
            <Text
              style={{
                color: "#09090b",
                fontWeight: "700",
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              No orders yet
            </Text>
            <Text
              style={{ color: "#6B7280", fontSize: 13, textAlign: "center" }}
            >
              Your past orders will appear here
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Wallet Drawer Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 40,
              minHeight: "55%",
            }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                backgroundColor: "#E5E7EB",
                borderRadius: 3,
                alignSelf: "center",
                marginBottom: 24,
              }}
            />
            <Text
              style={{
                fontSize: 19,
                fontWeight: "900",
                color: "#09090b",
                letterSpacing: -0.5,
                marginBottom: 4,
              }}
            >
              Your Wallet
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginBottom: 20 }}>
              Manage balance, fund or send money
            </Text>
            <View
              style={{
                backgroundColor: "#09090b",
                borderRadius: 20,
                padding: 22,
                marginBottom: 24,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 36,
                  width: 4,
                  height: "100%",
                  backgroundColor: "#EA580C",
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: "#6B7280",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  Available Balance
                </Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                  <Ionicons
                    name={showBalance ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 38,
                  fontWeight: "900",
                  letterSpacing: -1.5,
                }}
              >
                {showBalance
                  ? formatNaira(balance)
                  : "\u20A6 \u2022\u2022\u2022\u2022"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("FundWallet");
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#EA580C",
                  paddingVertical: 15,
                  borderRadius: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}
                >
                  Fund Wallet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#F3F4F6",
                  paddingVertical: 15,
                  borderRadius: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "#09090b", fontWeight: "800", fontSize: 15 }}
                >
                  Send Money
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
