/**
 * Customer App navigation placeholder.
 *
 * TODO: Set up React Navigation with:
 * - AuthStack (Login, Register, OTP, SetPin)
 * - MainTab (Home, Wallet, Delivery, Utilities, Profile)
 * - DeliveryStack (CreateOrder, Tracking, OrderDetail, Rating)
 * - WalletStack (Balance, Transfer, Transactions, Withdraw)
 */

// Navigation structure:
//
// RootNavigator
// ├── AuthStack
// │   ├── LoginScreen
// │   ├── RegisterScreen
// │   ├── OtpScreen
// │   └── SetPinScreen
// └── MainTab
//     ├── HomeTab → HomeScreen
//     ├── WalletTab → WalletStack
//     │   ├── WalletScreen
//     │   ├── TransferScreen
//     │   ├── TransactionsScreen
//     │   └── WithdrawScreen
//     ├── DeliveryTab → DeliveryStack
//     │   ├── CreateOrderScreen
//     │   ├── TrackingScreen
//     │   ├── OrderDetailScreen
//     │   └── RatingScreen
//     ├── UtilitiesTab → UtilitiesStack
//     │   ├── UtilitiesMenuScreen
//     │   ├── AirtimeScreen
//     │   ├── DataScreen
//     │   └── ElectricityScreen
//     └── ProfileTab → ProfileScreen

module.exports = {};
