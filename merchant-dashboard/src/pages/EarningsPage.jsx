import { useEffect, useState } from "react";
import { API_URL } from '../lib/api'
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchWallet,
  requestWithdrawal,
  fetchBankList,
} from "../store/slices/earningsSlice.js";
import {
  Wallet,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Download,
  Eye,
  FileText,
  Calculator,
  Receipt,
  TrendingUp,
  DollarSign,
  Flag,
  Upload,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { showErrorToast, showSuccessToast } from "../utils/toast.js";
import { CardSkeleton, TableSkeleton } from "../components/LoadingSkeleton.jsx";

export default function EarningsPage() {
  const { user } = useSelector((state) => state.auth);
  const merchantId = user?.merchantId;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { wallet, loading, banks, banksLoading } = useSelector(
    (state) => state.earnings,
  );
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [savedBankAccounts, setSavedBankAccounts] = useState([]);
  const [showSavedAccounts, setShowSavedAccounts] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [showWithdrawalHistory, setShowWithdrawalHistory] = useState(false);
  const [withdrawalLimits, setWithdrawalLimits] = useState({
    dailyLimit: 500000,
    monthlyLimit: 5000000,
    minAmount: 1000,
    maxAmount: 1000000,
    instantWithdrawalFee: 0.02, // 2%
    standardWithdrawalFee: 0,
  });
  const [instantWithdrawal, setInstantWithdrawal] = useState(false);

  // Dispute state variables
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showDisputes, setShowDisputes] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [disputeForm, setDisputeForm] = useState({
    transactionId: "",
    reason: "",
    description: "",
    evidence: [],
    category: "payment",
  });
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDisputeDetails, setShowDisputeDetails] = useState(false);

  // Refund state variables
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showRefundHistory, setShowRefundHistory] = useState(false);
  const [refunds, setRefunds] = useState([]);
  const [refundForm, setRefundForm] = useState({
    orderId: "",
    amount: "",
    reason: "",
    type: "full",
    description: "",
  });
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [showRefundDetails, setShowRefundDetails] = useState(false);

  // Date range state for exports
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Custom report generation state
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  const [customReport, setCustomReport] = useState({
    name: "",
    type: "transaction",
    format: "csv",
    fields: {
      date: true,
      type: true,
      amount: true,
      status: true,
      commission: false,
      tax: false,
      orderId: true,
      description: false,
    },
    filters: {
      status: "all",
      minAmount: "",
      maxAmount: "",
    },
  });

  useEffect(() => {
    dispatch(fetchWallet({ merchantId }));
    dispatch(fetchBankList());
  }, [dispatch, merchantId]);

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawalForm.amount);

    // Validate withdrawal limits
    if (amount < withdrawalLimits.minAmount) {
      showErrorToast(
        `Minimum withdrawal amount is ₦${withdrawalLimits.minAmount.toLocaleString()}`,
      );
      return;
    }

    if (amount > withdrawalLimits.maxAmount) {
      showErrorToast(
        `Maximum withdrawal amount is ₦${withdrawalLimits.maxAmount.toLocaleString()}`,
      );
      return;
    }

    // Calculate fees
    const feeAmount = instantWithdrawal
      ? amount * withdrawalLimits.instantWithdrawalFee
      : withdrawalLimits.standardWithdrawalFee;
    const totalAmount = amount + feeAmount;

    if (totalAmount > (wallet?.availableBalance || 0)) {
      showErrorToast("Insufficient balance for withdrawal including fees");
      return;
    }

    try {
      const withdrawalData = {
        merchantId,
        amount,
        bankCode: withdrawalForm.bankCode,
        accountNumber: withdrawalForm.accountNumber,
        accountName: withdrawalForm.accountName,
      };

      await dispatch(requestWithdrawal(withdrawalData)).unwrap();

      // Add to withdrawal history
      const newWithdrawal = {
        id: Date.now(),
        amount,
        fee: feeAmount,
        totalAmount,
        status: "PENDING",
        bankCode: withdrawalForm.bankCode,
        bankName:
          (Array.isArray(banks) ? banks : []).find((b) => b.code === withdrawalForm.bankCode)?.name ||
          withdrawalForm.bankCode,
        accountNumber: withdrawalForm.accountNumber,
        accountName: withdrawalForm.accountName,
        createdAt: new Date().toISOString(),
        estimatedProcessingTime: instantWithdrawal
          ? "5-10 minutes"
          : "24-48 hours",
      };

      setWithdrawalHistory([newWithdrawal, ...withdrawalHistory]);

      setShowWithdrawModal(false);
      setWithdrawalForm({
        amount: "",
        bankCode: "",
        accountNumber: "",
        accountName: "",
      });
      setInstantWithdrawal(false);
      dispatch(fetchWallet({ merchantId }));

      showSuccessToast(
        instantWithdrawal
          ? "Instant withdrawal request submitted - processing within 5-10 minutes"
          : "Withdrawal request submitted successfully - processing within 24-48 hours",
      );
    } catch (err) {
      showErrorToast("Failed to request withdrawal. Please try again.");
    }
  };

  const handleCancelWithdrawal = async (withdrawalId) => {
    if (confirm("Are you sure you want to cancel this withdrawal request?")) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API_URL}/merchants/${merchantId}/withdrawals/${withdrawalId}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          setWithdrawalHistory(
            withdrawalHistory.map((w) =>
              w.id === withdrawalId ? { ...w, status: "CANCELLED" } : w,
            ),
          );
          showSuccessToast("Withdrawal request cancelled successfully");
        } else {
          throw new Error("Failed to cancel withdrawal");
        }
      } catch (err) {
        showErrorToast("Failed to cancel withdrawal request");
      }
    }
  };

  const calculateWithdrawalFee = (amount) => {
    return instantWithdrawal
      ? amount * withdrawalLimits.instantWithdrawalFee
      : withdrawalLimits.standardWithdrawalFee;
  };

  const getWithdrawalStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "FAILED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const handleDownloadReceipt = (transaction) => {
    // Generate PDF receipt
    const receiptData = {
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      date: transaction.createdAt,
      merchantId,
      // Add more details as needed
    };

    // Create a simple text receipt for now (in real implementation, use PDF library)
    const receiptContent = `
TRANSACTION RECEIPT
==================
Transaction ID: ${transaction.id}
Type: ${transaction.type.replace(/_/g, " ")}
Amount: ₦${transaction.amount.toLocaleString()}
Status: ${transaction.status}
Date: ${format(new Date(transaction.createdAt), "PPPpp")}
Merchant ID: ${merchantId}

${transaction.orderId ? `Order ID: ${transaction.orderId}` : ""}
${transaction.commission ? `Commission: ₦${transaction.commission.toLocaleString()}` : ""}
${transaction.tax ? `Tax: ₦${transaction.tax.toLocaleString()}` : ""}
${transaction.notes ? `Notes: ${transaction.notes}` : ""}

Thank you for your business!
    `.trim();

    // Download as text file
    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${transaction.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessToast("Receipt downloaded successfully");
  };

  const handleSaveBankAccount = () => {
    if (
      withdrawalForm.bankCode &&
      withdrawalForm.accountNumber &&
      withdrawalForm.accountName
    ) {
      const newAccount = {
        id: Date.now(),
        bankCode: withdrawalForm.bankCode,
        bankName:
          (Array.isArray(banks) ? banks : []).find((b) => (b.code || b.bankCode) === withdrawalForm.bankCode)
            ?.name || withdrawalForm.bankCode,
        accountNumber: withdrawalForm.accountNumber,
        accountName: withdrawalForm.accountName,
        isDefault: savedBankAccounts.length === 0,
      };
      setSavedBankAccounts([...savedBankAccounts, newAccount]);
      showSuccessToast("Bank account saved successfully");
    }
  };

  const handleUseSavedAccount = (account) => {
    setWithdrawalForm({
      ...withdrawalForm,
      bankCode: account.bankCode || account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
    });
    setShowSavedAccounts(false);
  };

  // Dispute handling functions
  const handleCreateDispute = (e) => {
    e.preventDefault();
    if (
      disputeForm.transactionId &&
      disputeForm.reason &&
      disputeForm.description
    ) {
      const newDispute = {
        id: Date.now(),
        ...disputeForm,
        status: "OPEN",
        createdAt: new Date().toISOString(),
        merchantId,
        responses: [],
        evidence: disputeForm.evidence.map((file) => ({
          id: Date.now() + Math.random(),
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type,
        })),
      };
      setDisputes([newDispute, ...disputes]);
      setShowDisputeModal(false);
      setDisputeForm({
        transactionId: "",
        reason: "",
        description: "",
        evidence: [],
        category: "payment",
      });
      showSuccessToast("Dispute created successfully");
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setDisputeForm({
      ...disputeForm,
      evidence: [...disputeForm.evidence, ...files],
    });
  };

  const removeEvidenceFile = (index) => {
    setDisputeForm({
      ...disputeForm,
      evidence: disputeForm.evidence.filter((_, i) => i !== index),
    });
  };

  const handleViewDispute = (dispute) => {
    setSelectedDispute(dispute);
    setShowDisputeDetails(true);
  };

  const handleAddDisputeResponse = (disputeId) => {
    const response = prompt("Enter your response:");
    if (response && selectedDispute) {
      const updatedDisputes = disputes.map((dispute) =>
        dispute.id === disputeId
          ? {
              ...dispute,
              responses: [
                ...dispute.responses,
                {
                  id: Date.now(),
                  message: response,
                  sender: "merchant",
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : dispute,
      );
      setDisputes(updatedDisputes);
      setSelectedDispute({
        ...selectedDispute,
        responses: [
          ...selectedDispute.responses,
          {
            id: Date.now(),
            message: response,
            sender: "merchant",
            timestamp: new Date().toISOString(),
          },
        ],
      });
      showSuccessToast("Response added successfully");
    }
  };

  const getDisputeStatusColor = (status) => {
    switch (status) {
      case "OPEN":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "UNDER_REVIEW":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "RESOLVED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "CLOSED":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Refund handling functions
  const handleCreateRefund = (e) => {
    e.preventDefault();
    if (refundForm.orderId && refundForm.amount && refundForm.reason) {
      const newRefund = {
        id: Date.now(),
        ...refundForm,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        merchantId,
        customerName: "Customer Name", // In real app, get from order
        orderTotal:
          refundForm.type === "full"
            ? refundForm.amount
            : parseFloat(refundForm.amount) * 2,
      };
      setRefunds([newRefund, ...refunds]);
      setShowRefundModal(false);
      setRefundForm({
        orderId: "",
        amount: "",
        reason: "",
        type: "full",
        description: "",
      });
      showSuccessToast("Refund request created successfully");
    }
  };

  const handleViewRefund = (refund) => {
    setSelectedRefund(refund);
    setShowRefundDetails(true);
  };

  const handleProcessRefund = (refundId, action) => {
    const updatedRefunds = refunds.map((refund) =>
      refund.id === refundId
        ? {
            ...refund,
            status: action === "approve" ? "APPROVED" : "REJECTED",
            processedAt: new Date().toISOString(),
          }
        : refund,
    );
    setRefunds(updatedRefunds);
    if (selectedRefund && selectedRefund.id === refundId) {
      setSelectedRefund({
        ...selectedRefund,
        status: action === "approve" ? "APPROVED" : "REJECTED",
        processedAt: new Date().toISOString(),
      });
    }
    showSuccessToast(
      `Refund ${action === "approve" ? "approved" : "rejected"} successfully`,
    );
  };

  const getRefundStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "APPROVED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "PROCESSED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  // Export functions
  const exportTransactionsToCSV = () => {
    if (!wallet.transactions || wallet.transactions.length === 0) {
      showErrorToast("No transactions to export");
      return;
    }

    // Filter transactions by date range if specified
    let filteredTransactions = wallet.transactions;
    if (dateRange.startDate || dateRange.endDate) {
      filteredTransactions = wallet.transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && transactionDate < startDate) return false;
        if (endDate && transactionDate > endDate) return false;
        return true;
      });
    }

    if (filteredTransactions.length === 0) {
      showErrorToast("No transactions found in the selected date range");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Amount",
      "Commission",
      "Tax",
      "Net Amount",
      "Status",
      "Order ID",
      "Description",
    ];
    const csvData = filteredTransactions.map((transaction) => [
      format(new Date(transaction.createdAt), "yyyy-MM-dd HH:mm:ss"),
      transaction.type,
      transaction.amount,
      transaction.commission || 0,
      transaction.tax || 0,
      transaction.netAmount || transaction.amount,
      transaction.status,
      transaction.orderId || "N/A",
      transaction.description || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateSuffix =
      dateRange.startDate || dateRange.endDate
        ? `_${dateRange.startDate || "all"}_to_${dateRange.endDate || "all"}`
        : "";
    link.setAttribute(
      "download",
      `transactions${dateSuffix}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccessToast(
      `${filteredTransactions.length} transactions exported to CSV successfully`,
    );
  };

  const exportRefundsToCSV = () => {
    if (refunds.length === 0) {
      showErrorToast("No refunds to export");
      return;
    }

    // Filter refunds by date range if specified
    let filteredRefunds = refunds;
    if (dateRange.startDate || dateRange.endDate) {
      filteredRefunds = refunds.filter((refund) => {
        const refundDate = new Date(refund.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && refundDate < startDate) return false;
        if (endDate && refundDate > endDate) return false;
        return true;
      });
    }

    if (filteredRefunds.length === 0) {
      showErrorToast("No refunds found in the selected date range");
      return;
    }

    const headers = [
      "Date",
      "Order ID",
      "Customer",
      "Amount",
      "Type",
      "Reason",
      "Status",
      "Description",
    ];
    const csvData = filteredRefunds.map((refund) => [
      format(new Date(refund.createdAt), "yyyy-MM-dd HH:mm:ss"),
      refund.orderId,
      refund.customerName,
      refund.amount,
      refund.type,
      refund.reason,
      refund.status,
      refund.description || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateSuffix =
      dateRange.startDate || dateRange.endDate
        ? `_${dateRange.startDate || "all"}_to_${dateRange.endDate || "all"}`
        : "";
    link.setAttribute(
      "download",
      `refunds${dateSuffix}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccessToast(
      `${filteredRefunds.length} refunds exported to CSV successfully`,
    );
  };

  const exportDisputesToCSV = () => {
    if (disputes.length === 0) {
      showErrorToast("No disputes to export");
      return;
    }

    // Filter disputes by date range if specified
    let filteredDisputes = disputes;
    if (dateRange.startDate || dateRange.endDate) {
      filteredDisputes = disputes.filter((dispute) => {
        const disputeDate = new Date(dispute.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && disputeDate < startDate) return false;
        if (endDate && disputeDate > endDate) return false;
        return true;
      });
    }

    if (filteredDisputes.length === 0) {
      showErrorToast("No disputes found in the selected date range");
      return;
    }

    const headers = [
      "Date",
      "Transaction ID",
      "Category",
      "Status",
      "Reason",
      "Description",
      "Resolution",
    ];
    const csvData = filteredDisputes.map((dispute) => [
      format(new Date(dispute.createdAt), "yyyy-MM-dd HH:mm:ss"),
      dispute.transactionId,
      dispute.category,
      dispute.status,
      dispute.reason,
      dispute.description || "N/A",
      dispute.resolution || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const dateSuffix =
      dateRange.startDate || dateRange.endDate
        ? `_${dateRange.startDate || "all"}_to_${dateRange.endDate || "all"}`
        : "";
    link.setAttribute(
      "download",
      `disputes${dateSuffix}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccessToast(
      `${filteredDisputes.length} disputes exported to CSV successfully`,
    );
  };

  const generateCustomReport = () => {
    if (!customReport.name) {
      showErrorToast("Please enter a report name");
      return;
    }

    let data = [];
    let headers = [];

    // Get data based on report type
    switch (customReport.type) {
      case "transaction":
        if (!wallet.transactions || wallet.transactions.length === 0) {
          showErrorToast("No transactions available");
          return;
        }

        data = wallet.transactions.filter((transaction) => {
          // Apply date range filter
          const transactionDate = new Date(transaction.createdAt);
          const startDate = dateRange.startDate
            ? new Date(dateRange.startDate)
            : null;
          const endDate = dateRange.endDate
            ? new Date(dateRange.endDate + "T23:59:59")
            : null;

          if (startDate && transactionDate < startDate) return false;
          if (endDate && transactionDate > endDate) return false;

          // Apply status filter
          if (
            customReport.filters.status !== "all" &&
            transaction.status !== customReport.filters.status
          )
            return false;

          // Apply amount filters
          if (
            customReport.filters.minAmount &&
            transaction.amount < parseFloat(customReport.filters.minAmount)
          )
            return false;
          if (
            customReport.filters.maxAmount &&
            transaction.amount > parseFloat(customReport.filters.maxAmount)
          )
            return false;

          return true;
        });

        // Build headers based on selected fields
        if (customReport.fields.date) headers.push("Date");
        if (customReport.fields.type) headers.push("Type");
        if (customReport.fields.amount) headers.push("Amount");
        if (customReport.fields.status) headers.push("Status");
        if (customReport.fields.commission) headers.push("Commission");
        if (customReport.fields.tax) headers.push("Tax");
        if (customReport.fields.orderId) headers.push("Order ID");
        if (customReport.fields.description) headers.push("Description");
        break;

      case "refund":
        if (refunds.length === 0) {
          showErrorToast("No refunds available");
          return;
        }

        data = refunds.filter((refund) => {
          const refundDate = new Date(refund.createdAt);
          const startDate = dateRange.startDate
            ? new Date(dateRange.startDate)
            : null;
          const endDate = dateRange.endDate
            ? new Date(dateRange.endDate + "T23:59:59")
            : null;

          if (startDate && refundDate < startDate) return false;
          if (endDate && refundDate > endDate) return false;

          if (
            customReport.filters.status !== "all" &&
            refund.status !== customReport.filters.status
          )
            return false;

          if (
            customReport.filters.minAmount &&
            refund.amount < parseFloat(customReport.filters.minAmount)
          )
            return false;
          if (
            customReport.filters.maxAmount &&
            refund.amount > parseFloat(customReport.filters.maxAmount)
          )
            return false;

          return true;
        });

        if (customReport.fields.date) headers.push("Date");
        if (customReport.fields.orderId) headers.push("Order ID");
        if (customReport.fields.amount) headers.push("Amount");
        if (customReport.fields.status) headers.push("Status");
        if (customReport.fields.description) headers.push("Description");
        break;

      case "dispute":
        if (disputes.length === 0) {
          showErrorToast("No disputes available");
          return;
        }

        data = disputes.filter((dispute) => {
          const disputeDate = new Date(dispute.createdAt);
          const startDate = dateRange.startDate
            ? new Date(dateRange.startDate)
            : null;
          const endDate = dateRange.endDate
            ? new Date(dateRange.endDate + "T23:59:59")
            : null;

          if (startDate && disputeDate < startDate) return false;
          if (endDate && disputeDate > endDate) return false;

          if (
            customReport.filters.status !== "all" &&
            dispute.status !== customReport.filters.status
          )
            return false;

          return true;
        });

        if (customReport.fields.date) headers.push("Date");
        if (customReport.fields.orderId) headers.push("Transaction ID");
        if (customReport.fields.status) headers.push("Status");
        if (customReport.fields.description) headers.push("Description");
        break;
    }

    if (data.length === 0) {
      showErrorToast("No data found matching the selected criteria");
      return;
    }

    // Generate report based on format
    if (customReport.format === "csv") {
      const csvData = data.map((item) => {
        const row = [];
        if (customReport.type === "transaction") {
          if (customReport.fields.date)
            row.push(format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss"));
          if (customReport.fields.type) row.push(item.type);
          if (customReport.fields.amount) row.push(item.amount);
          if (customReport.fields.status) row.push(item.status);
          if (customReport.fields.commission) row.push(item.commission || 0);
          if (customReport.fields.tax) row.push(item.tax || 0);
          if (customReport.fields.orderId) row.push(item.orderId || "N/A");
          if (customReport.fields.description)
            row.push(item.description || "N/A");
        } else if (customReport.type === "refund") {
          if (customReport.fields.date)
            row.push(format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss"));
          if (customReport.fields.orderId) row.push(item.orderId);
          if (customReport.fields.amount) row.push(item.amount);
          if (customReport.fields.status) row.push(item.status);
          if (customReport.fields.description)
            row.push(item.description || "N/A");
        } else if (customReport.type === "dispute") {
          if (customReport.fields.date)
            row.push(format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss"));
          if (customReport.fields.orderId) row.push(item.transactionId);
          if (customReport.fields.status) row.push(item.status);
          if (customReport.fields.description)
            row.push(item.description || "N/A");
        }
        return row;
      });

      const csvContent = [
        headers.join(","),
        ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${customReport.name}_${format(new Date(), "yyyy-MM-dd")}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccessToast(
        `Custom report "${customReport.name}" generated successfully with ${data.length} records`,
      );
    } else if (customReport.format === "pdf") {
      // Generate PDF report
      const printWindow = window.open("", "_blank");
      const currentDate = format(new Date(), "PPPpp");

      let tableRows = "";
      data.forEach((item) => {
        let row = "<tr>";
        if (customReport.type === "transaction") {
          if (customReport.fields.date)
            row += `<td>${format(new Date(item.createdAt), "PPP")}</td>`;
          if (customReport.fields.type) row += `<td>${item.type}</td>`;
          if (customReport.fields.amount)
            row += `<td>₦${item.amount.toLocaleString()}</td>`;
          if (customReport.fields.status)
            row += `<td class="status-${item.status.toLowerCase()}">${item.status}</td>`;
          if (customReport.fields.commission)
            row += `<td>₦${(item.commission || 0).toLocaleString()}</td>`;
          if (customReport.fields.tax)
            row += `<td>₦${(item.tax || 0).toLocaleString()}</td>`;
          if (customReport.fields.orderId)
            row += `<td>${item.orderId || "N/A"}</td>`;
          if (customReport.fields.description)
            row += `<td>${item.description || "N/A"}</td>`;
        } else if (customReport.type === "refund") {
          if (customReport.fields.date)
            row += `<td>${format(new Date(item.createdAt), "PPP")}</td>`;
          if (customReport.fields.orderId) row += `<td>${item.orderId}</td>`;
          if (customReport.fields.amount)
            row += `<td>₦${item.amount.toLocaleString()}</td>`;
          if (customReport.fields.status)
            row += `<td class="status-${item.status.toLowerCase()}">${item.status}</td>`;
          if (customReport.fields.description)
            row += `<td>${item.description || "N/A"}</td>`;
        } else if (customReport.type === "dispute") {
          if (customReport.fields.date)
            row += `<td>${format(new Date(item.createdAt), "PPP")}</td>`;
          if (customReport.fields.orderId)
            row += `<td>${item.transactionId}</td>`;
          if (customReport.fields.status)
            row += `<td class="status-${item.status.toLowerCase()}">${item.status}</td>`;
          if (customReport.fields.description)
            row += `<td>${item.description || "N/A"}</td>`;
        }
        row += "</tr>";
        tableRows += row;
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${customReport.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #333; }
            .header p { margin: 5px 0; color: #666; }
            .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .status-pending { color: #f59e0b; }
            .status-approved { color: #10b981; }
            .status-rejected { color: #ef4444; }
            .status-resolved { color: #10b981; }
            .status-closed { color: #6b7280; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            @media print { body { margin: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${customReport.name}</h1>
            <p>Custom Report - ${customReport.type.charAt(0).toUpperCase() + customReport.type.slice(1)} Data</p>
            <p>Generated on: ${currentDate}</p>
          </div>
          <div class="summary">
            <h3>Report Summary</h3>
            <p><strong>Total Records:</strong> ${data.length}</p>
            <p><strong>Date Range:</strong> ${dateRange.startDate || "Beginning"} to ${dateRange.endDate || "Present"}</p>
            <p><strong>Filters Applied:</strong> Status: ${customReport.filters.status}, Amount Range: ₦${customReport.filters.minAmount || "0"} - ₦${customReport.filters.maxAmount || "∞"}</p>
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map((header) => `<th>${header.charAt(0).toUpperCase() + header.slice(1)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            <p>This is a custom generated report from the merchant dashboard</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);

      showSuccessToast(
        `Custom report "${customReport.name}" PDF generated successfully`,
      );
    }

    setShowCustomReportModal(false);
  };

  const exportToPDF = (type) => {
    const printWindow = window.open("", "_blank");
    const currentDate = format(new Date(), "PPPpp");

    let content = "";
    let title = "";

    switch (type) {
      case "statement":
        title = "Financial Statement";
        content = generateStatementContent();
        break;
      case "transactions":
        title = "Transaction Report";
        content = generateTransactionReportContent();
        break;
      case "refunds":
        title = "Refund Report";
        content = generateRefundReportContent();
        break;
      case "disputes":
        title = "Dispute Report";
        content = generateDisputeReportContent();
        break;
      default:
        return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #333; }
          .header p { margin: 5px 0; color: #666; }
          .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
          .summary h3 { margin: 0 0 10px 0; color: #333; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
          .summary-item { padding: 10px; background: white; border-radius: 3px; }
          .summary-item strong { display: block; color: #333; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .status-pending { color: #f59e0b; }
          .status-approved { color: #10b981; }
          .status-rejected { color: #ef4444; }
          .status-resolved { color: #10b981; }
          .status-closed { color: #6b7280; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
          @media print { body { margin: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>Merchant Dashboard</p>
          <p>Generated on: ${currentDate}</p>
        </div>
        ${content}
        <div class="footer">
          <p>This is an official merchant dashboard statement</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for the content to load, then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);

    showSuccessToast(`${title} PDF generated successfully`);
  };

  const generateStatementContent = () => {
    // Filter transactions by date range if specified
    let filteredTransactions = wallet.transactions || [];
    let filteredWithdrawals = withdrawalHistory;
    let filteredRefunds = refunds;

    if (dateRange.startDate || dateRange.endDate) {
      filteredTransactions = (wallet.transactions || []).filter(
        (transaction) => {
          const transactionDate = new Date(transaction.createdAt);
          const startDate = dateRange.startDate
            ? new Date(dateRange.startDate)
            : null;
          const endDate = dateRange.endDate
            ? new Date(dateRange.endDate + "T23:59:59")
            : null;

          if (startDate && transactionDate < startDate) return false;
          if (endDate && transactionDate > endDate) return false;
          return true;
        },
      );

      filteredWithdrawals = withdrawalHistory.filter((withdrawal) => {
        const withdrawalDate = new Date(withdrawal.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && withdrawalDate < startDate) return false;
        if (endDate && withdrawalDate > endDate) return false;
        return true;
      });

      filteredRefunds = refunds.filter((refund) => {
        const refundDate = new Date(refund.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && refundDate < startDate) return false;
        if (endDate && refundDate > endDate) return false;
        return true;
      });
    }

    const totalEarnings = filteredTransactions
      .filter((t) => t.type === "earning")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = filteredWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0,
    );
    const totalRefunds = filteredRefunds.reduce((sum, r) => sum + r.amount, 0);
    const pendingWithdrawals = filteredWithdrawals
      .filter((w) => w.status === "PENDING" || w.status === "PROCESSING")
      .reduce((sum, w) => sum + w.amount, 0);

    return `
      <div class="summary">
        <h3>Account Summary</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Available Balance</strong>
            ₦${wallet.availableBalance?.toLocaleString() || 0}
          </div>
          <div class="summary-item">
            <strong>Total Earnings</strong>
            ₦${totalEarnings.toLocaleString()}
          </div>
          <div class="summary-item">
            <strong>Total Withdrawals</strong>
            ₦${totalWithdrawals.toLocaleString()}
          </div>
          <div class="summary-item">
            <strong>Total Refunds</strong>
            ₦${totalRefunds.toLocaleString()}
          </div>
          <div class="summary-item">
            <strong>Pending Withdrawals</strong>
            ₦${pendingWithdrawals.toLocaleString()}
          </div>
          <div class="summary-item">
            <strong>Commission Rate</strong>
            10%
          </div>
        </div>
      </div>
      
      <h3>Recent Transactions</h3>
      ${
        filteredTransactions.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions
              .slice(0, 10)
              .map(
                (t) => `
              <tr>
                <td>${format(new Date(t.createdAt), "PPP")}</td>
                <td>${t.type}</td>
                <td>₦${t.amount.toLocaleString()}</td>
                <td class="status-${t.status.toLowerCase()}">${t.status}</td>
                <td>${t.description || "N/A"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `
          : "<p>No transactions available</p>"
      }
      
      <h3>Withdrawal History</h3>
      ${
        filteredWithdrawals.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Bank</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredWithdrawals
              .slice(0, 10)
              .map(
                (w) => `
              <tr>
                <td>${format(new Date(w.createdAt), "PPP")}</td>
                <td>₦${w.amount.toLocaleString()}</td>
                <td>${w.bankName}</td>
                <td class="status-${w.status.toLowerCase()}">${w.status}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `
          : "<p>No withdrawals available</p>"
      }
    `;
  };

  const generateTransactionReportContent = () => {
    // Filter transactions by date range if specified
    let filteredTransactions = wallet.transactions || [];
    if (dateRange.startDate || dateRange.endDate) {
      filteredTransactions = (wallet.transactions || []).filter(
        (transaction) => {
          const transactionDate = new Date(transaction.createdAt);
          const startDate = dateRange.startDate
            ? new Date(dateRange.startDate)
            : null;
          const endDate = dateRange.endDate
            ? new Date(dateRange.endDate + "T23:59:59")
            : null;

          if (startDate && transactionDate < startDate) return false;
          if (endDate && transactionDate > endDate) return false;
          return true;
        },
      );
    }

    if (!filteredTransactions || filteredTransactions.length === 0) {
      return "<p>No transactions available</p>";
    }

    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Commission</th>
            <th>Tax</th>
            <th>Net Amount</th>
            <th>Status</th>
            <th>Order ID</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTransactions
            .map(
              (t) => `
            <tr>
              <td>${format(new Date(t.createdAt), "PPP")}</td>
              <td>${t.type}</td>
              <td>₦${t.amount.toLocaleString()}</td>
              <td>₦${(t.commission || 0).toLocaleString()}</td>
              <td>₦${(t.tax || 0).toLocaleString()}</td>
              <td>₦${(t.netAmount || t.amount).toLocaleString()}</td>
              <td class="status-${t.status.toLowerCase()}">${t.status}</td>
              <td>${t.orderId || "N/A"}</td>
              <td>${t.description || "N/A"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  };

  const generateRefundReportContent = () => {
    // Filter refunds by date range if specified
    let filteredRefunds = refunds;
    if (dateRange.startDate || dateRange.endDate) {
      filteredRefunds = refunds.filter((refund) => {
        const refundDate = new Date(refund.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && refundDate < startDate) return false;
        if (endDate && refundDate > endDate) return false;
        return true;
      });
    }

    if (!filteredRefunds || filteredRefunds.length === 0) {
      return "<p>No refunds available</p>";
    }

    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRefunds
            .map(
              (r) => `
            <tr>
              <td>${format(new Date(r.createdAt), "PPP")}</td>
              <td>${r.orderId}</td>
              <td>${r.customerName}</td>
              <td>₦${r.amount.toLocaleString()}</td>
              <td>${r.type}</td>
              <td>${r.reason.replace(/_/g, " ")}</td>
              <td class="status-${r.status.toLowerCase()}">${r.status}</td>
              <td>${r.description || "N/A"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  };

  const generateDisputeReportContent = () => {
    // Filter disputes by date range if specified
    let filteredDisputes = disputes;
    if (dateRange.startDate || dateRange.endDate) {
      filteredDisputes = disputes.filter((dispute) => {
        const disputeDate = new Date(dispute.createdAt);
        const startDate = dateRange.startDate
          ? new Date(dateRange.startDate)
          : null;
        const endDate = dateRange.endDate
          ? new Date(dateRange.endDate + "T23:59:59")
          : null;

        if (startDate && disputeDate < startDate) return false;
        if (endDate && disputeDate > endDate) return false;
        return true;
      });
    }

    if (!filteredDisputes || filteredDisputes.length === 0) {
      return "<p>No disputes available</p>";
    }

    return `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction ID</th>
            <th>Category</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Description</th>
            <th>Resolution</th>
          </tr>
        </thead>
        <tbody>
          ${filteredDisputes
            .map(
              (d) => `
            <tr>
              <td>${format(new Date(d.createdAt), "PPP")}</td>
              <td>${d.transactionId}</td>
              <td>${d.category}</td>
              <td class="status-${d.status.toLowerCase()}">${d.status}</td>
              <td>${d.reason}</td>
              <td>${d.description || "N/A"}</td>
              <td>${d.resolution || "N/A"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">
            Earnings
          </h1>
          <p className="text-muted dark:text-dark-muted">
            View your wallet balance and transactions
          </p>
        </div>
        <button
          onClick={() => dispatch(fetchWallet({ merchantId }))}
          className="p-2 text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={5} columns={4} />
        </>
      ) : wallet ? (
        <>
          {/* Enhanced Wallet Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Available Balance</h2>
              </div>
              <p className="text-4xl font-bold">
                ₦{wallet.availableBalance?.toLocaleString() || "0"}
              </p>
              <p className="text-blue-100 mt-2 text-sm">Ready for withdrawal</p>
            </div>
            <div className="bg-gradient-to-br from-surface-700 to-surface-800 rounded-xl p-6 text-accent">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Pending Balance</h3>
              </div>
              <p className="text-4xl font-bold">
                ₦{wallet.pendingBalance?.toLocaleString() || "0"}
              </p>
              <p className="text-surface-300 mt-2 text-sm">
                Awaiting settlement
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Total Earnings</h2>
              </div>
              <p className="text-4xl font-bold">
                ₦
                {(
                  (wallet.availableBalance || 0) + (wallet.pendingBalance || 0)
                ).toLocaleString()}
              </p>
              <p className="text-green-100 mt-2 text-sm">All time earnings</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <Calculator className="w-6 h-6" />
                <h2 className="text-lg font-semibold">Total Commission</h2>
              </div>
              <p className="text-4xl font-bold">
                ₦{wallet.totalCommission?.toLocaleString() || "0"}
              </p>
              <p className="text-purple-100 mt-2 text-sm">Platform fees paid</p>
            </div>
          </div>

          {/* Withdrawal Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowWithdrawalHistory(true)}
              className="flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              <FileText className="w-4 h-4" />
              Withdrawal History
            </button>
            <button
              onClick={() => setShowRefundHistory(true)}
              className="flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              <AlertCircle className="w-4 h-4" />
              Refund History
            </button>
            <button
              onClick={() => navigate('/dashboard/support')}
              className="flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              <Flag className="w-4 h-4" />
              Disputes
            </button>
            <button
              onClick={() => setShowRefundModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              Process Refund
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={
                !wallet.availableBalance || wallet.availableBalance === 0
              }
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="w-5 h-5" />
              Request Withdrawal
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4">
            <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
              Date Range Filter
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setDateRange({ startDate: "", endDate: "" })}
                  className="px-4 py-2 text-muted dark:text-dark-muted border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
                >
                  Clear Filter
                </button>
              </div>
            </div>
            {(dateRange.startDate || dateRange.endDate) && (
              <div className="mt-3 text-sm text-muted dark:text-dark-muted">
                Filtering: {dateRange.startDate || "Beginning"} to{" "}
                {dateRange.endDate || "Present"}
              </div>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportTransactionsToCSV}
              className="flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              <Download className="w-4 h-4" />
              Export Transactions (CSV)
            </button>
            <button
              onClick={exportRefundsToCSV}
              className="flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              <Download className="w-4 h-4" />
              Export Refunds (CSV)
            </button>
          </div>

          {/* PDF Export Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportToPDF("statement")}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Financial Statement (PDF)
            </button>
            <button
              onClick={() => exportToPDF("transactions")}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Transaction Report (PDF)
            </button>
            <button
              onClick={() => exportToPDF("refunds")}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Refund Report (PDF)
            </button>
          </div>

          {/* Custom Report Generation */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowCustomReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Generate Custom Report
            </button>
          </div>

          {/* Transaction History */}
          <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text">
                Transaction History
              </h2>
            </div>
            {!wallet.transactions || wallet.transactions.length === 0 ? (
              <div className="p-6 text-center text-muted dark:text-dark-muted">
                No transactions yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Tax
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Net Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                    {(wallet.transactions || []).map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                          <div className="flex items-center gap-2">
                            {transaction.type === "EARNING" && (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            )}
                            {transaction.type === "WITHDRAWAL" && (
                              <ArrowUpRight className="w-4 h-4 text-red-600" />
                            )}
                            {transaction.type === "REFUND" && (
                              <AlertCircle className="w-4 h-4 text-yellow-600" />
                            )}
                            {transaction.type.replace(/_/g, " ")}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {transaction.type === "WITHDRAWAL" ? "-" : "+"}₦
                          {transaction.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                          {transaction.commission
                            ? `₦${transaction.commission.toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                          {transaction.tax
                            ? `₦${transaction.tax.toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                          ₦
                          {(
                            (transaction.amount || 0) -
                            (transaction.commission || 0) -
                            (transaction.tax || 0)
                          ).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              transaction.status === "COMPLETED"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : transaction.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : transaction.status === "FAILED"
                                    ? "bg-error/10 text-error"
                                    : "bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted"
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                          {format(
                            new Date(transaction.createdAt),
                            "MMM dd, yyyy HH:mm",
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewTransaction(transaction)}
                              className="p-1 text-primary hover:bg-primary/10 dark:text-primary dark:hover:bg-primary/10 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadReceipt(transaction)}
                              className="p-1 text-success hover:bg-success/10 dark:text-success dark:hover:bg-success/10 rounded transition-colors"
                              title="Download Receipt"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Enhanced Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text dark:text-dark-text">
                  Request Withdrawal
                </h2>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 text-error hover:bg-error/10 rounded-md"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleWithdrawal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Amount (₦)
                </label>
                <input
                  type="number"
                  required
                  min={withdrawalLimits.minAmount}
                  max={Math.min(
                    withdrawalLimits.maxAmount,
                    wallet?.availableBalance || 0,
                  )}
                  value={withdrawalForm.amount}
                  onChange={(e) =>
                    setWithdrawalForm({
                      ...withdrawalForm,
                      amount: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface dark:text-dark-text"
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted dark:text-dark-muted">
                    Available: ₦
                    {wallet?.availableBalance?.toLocaleString() || "0"}
                  </p>
                  <p className="text-xs text-muted dark:text-dark-muted">
                    Min: ₦{withdrawalLimits.minAmount.toLocaleString()} | Max: ₦
                    {withdrawalLimits.maxAmount.toLocaleString()}
                  </p>
                  {withdrawalForm.amount && (
                    <p className="text-xs text-primary dark:text-primary">
                      Fee: ₦
                      {calculateWithdrawalFee(
                        parseFloat(withdrawalForm.amount) || 0,
                      ).toLocaleString()}
                      {instantWithdrawal &&
                        ` (${(withdrawalLimits.instantWithdrawalFee * 100).toFixed(0)}%)`}
                    </p>
                  )}
                </div>
              </div>

              {/* Withdrawal Type Selection */}
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Withdrawal Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-surface-muted dark:border-dark-surface-muted rounded-lg cursor-pointer hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                    <input
                      type="radio"
                      name="withdrawalType"
                      checked={!instantWithdrawal}
                      onChange={() => setInstantWithdrawal(false)}
                      className="w-4 h-4 text-primary border-surface-muted dark:border-dark-surface-muted focus:ring-primary"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text dark:text-dark-text">
                          Standard Withdrawal
                        </span>
                        <span className="text-sm text-success dark:text-success">
                          Free
                        </span>
                      </div>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        Processing time: 24-48 hours
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-surface-muted dark:border-dark-surface-muted rounded-lg cursor-pointer hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                    <input
                      type="radio"
                      name="withdrawalType"
                      checked={instantWithdrawal}
                      onChange={() => setInstantWithdrawal(true)}
                      className="w-4 h-4 text-primary border-surface-muted dark:border-dark-surface-muted focus:ring-primary"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text dark:text-dark-text">
                          Instant Withdrawal
                        </span>
                        <span className="text-sm text-orange-600 dark:text-orange-400">
                          {(
                            withdrawalLimits.instantWithdrawalFee * 100
                          ).toFixed(0)}
                          % fee
                        </span>
                      </div>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        Processing time: 5-10 minutes
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Withdrawal Limits Info */}
              <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-primary dark:text-primary mb-2">
                  Withdrawal Limits
                </h4>
                <div className="space-y-1 text-xs text-primary dark:text-primary">
                  <p>
                    • Daily limit: ₦
                    {withdrawalLimits.dailyLimit.toLocaleString()}
                  </p>
                  <p>
                    • Monthly limit: ₦
                    {withdrawalLimits.monthlyLimit.toLocaleString()}
                  </p>
                  <p>
                    • Minimum amount: ₦
                    {withdrawalLimits.minAmount.toLocaleString()}
                  </p>
                  <p>
                    • Maximum amount: ₦
                    {withdrawalLimits.maxAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Saved Bank Accounts */}
              {savedBankAccounts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-text dark:text-dark-text">
                      Saved Bank Accounts
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSavedAccounts(!showSavedAccounts)}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {showSavedAccounts ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showSavedAccounts && (
                    <div className="space-y-2 mb-4">
                      {savedBankAccounts.map((account) => (
                        <div
                          key={account.id}
                          onClick={() => handleUseSavedAccount(account)}
                          className="p-3 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-text dark:text-dark-text">
                                {account.bankName}
                              </p>
                              <p className="text-sm text-muted dark:text-dark-muted">
                                {account.accountName}
                              </p>
                              <p className="text-xs text-muted dark:text-dark-muted">
                                ****{account.accountNumber.slice(-4)}
                              </p>
                            </div>
                            {account.isDefault && (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Bank
                </label>
                <select
                  required
                  value={withdrawalForm.bankCode}
                  onChange={(e) =>
                    setWithdrawalForm({
                      ...withdrawalForm,
                      bankCode: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface dark:text-dark-text"
                  disabled={banksLoading}
                >
                  <option value="">
                    {banksLoading ? "Loading banks…" : "Select a bank"}
                  </option>
                  {(Array.isArray(banks) ? banks : []).map((bank) => (
                    <option
                      key={bank.code || bank.bankCode}
                      value={bank.code || bank.bankCode}
                    >
                      {bank.name || bank.bankName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  required
                  minLength="10"
                  value={withdrawalForm.accountNumber}
                  onChange={(e) =>
                    setWithdrawalForm({
                      ...withdrawalForm,
                      accountNumber: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={withdrawalForm.accountName}
                  onChange={(e) =>
                    setWithdrawalForm({
                      ...withdrawalForm,
                      accountName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface dark:text-dark-text"
                />
              </div>

              {/* Save Bank Account Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="saveAccount"
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSaveBankAccount();
                    }
                  }}
                  className="w-4 h-4 text-primary border-surface-muted dark:border-dark-surface-muted rounded focus:ring-primary"
                />
                <label
                  htmlFor="saveAccount"
                  className="ml-2 text-sm text-text dark:text-dark-text"
                >
                  Save this bank account for future withdrawals
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawalForm({
                      amount: "",
                      bankCode: "",
                      accountNumber: "",
                      accountName: "",
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Request Withdrawal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showTransactionDetails && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text dark:text-dark-text">
                  Transaction Details
                </h2>
                <button
                  onClick={() => {
                    setShowTransactionDetails(false);
                    setSelectedTransaction(null);
                  }}
                  className="p-2 text-error hover:bg-error/10 rounded-md"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Transaction Overview */}
              <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedTransaction.type === "EARNING"
                          ? "bg-green-100 dark:bg-green-900/30"
                          : selectedTransaction.type === "WITHDRAWAL"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-yellow-100 dark:bg-yellow-900/30"
                      }`}
                    >
                      {selectedTransaction.type === "EARNING" && (
                        <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                      )}
                      {selectedTransaction.type === "WITHDRAWAL" && (
                        <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                      )}
                      {selectedTransaction.type === "REFUND" && (
                        <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                        {selectedTransaction.type.replace(/_/g, " ")}
                      </h3>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        ID: {selectedTransaction.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-text dark:text-dark-text">
                      {selectedTransaction.type === "WITHDRAWAL" ? "-" : "+"}₦
                      {selectedTransaction.amount.toLocaleString()}
                    </p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedTransaction.status === "COMPLETED"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : selectedTransaction.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : selectedTransaction.status === "FAILED"
                              ? "bg-error/10 text-error"
                              : "bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted"
                      }`}
                    >
                      {selectedTransaction.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div>
                <h4 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
                  Financial Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-surface-muted dark:border-dark-surface-muted">
                    <span className="text-muted dark:text-dark-muted">
                      Gross Amount
                    </span>
                    <span className="font-medium text-text dark:text-dark-text">
                      ₦{selectedTransaction.amount.toLocaleString()}
                    </span>
                  </div>
                  {selectedTransaction.commission && (
                    <div className="flex justify-between items-center py-2 border-b border-surface-muted dark:border-dark-surface-muted">
                      <span className="text-muted dark:text-dark-muted">
                        Platform Commission
                      </span>
                      <span className="font-medium text-error dark:text-error">
                        -₦{selectedTransaction.commission.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedTransaction.tax && (
                    <div className="flex justify-between items-center py-2 border-b border-surface-muted dark:border-dark-surface-muted">
                      <span className="text-muted dark:text-dark-muted">
                        Tax
                      </span>
                      <span className="font-medium text-error dark:text-error">
                        -₦{selectedTransaction.tax.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold text-text dark:text-dark-text">
                      Net Amount
                    </span>
                    <span className="font-bold text-lg text-text dark:text-dark-text">
                      ₦
                      {(
                        (selectedTransaction.amount || 0) -
                        (selectedTransaction.commission || 0) -
                        (selectedTransaction.tax || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Information */}
              <div>
                <h4 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
                  Transaction Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Date & Time
                    </p>
                    <p className="font-medium text-text dark:text-dark-text">
                      {format(new Date(selectedTransaction.createdAt), "PPPpp")}
                    </p>
                  </div>
                  {selectedTransaction.orderId && (
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        Order ID
                      </p>
                      <p className="font-medium text-text dark:text-dark-text">
                        #{selectedTransaction.orderId}
                      </p>
                    </div>
                  )}
                  {selectedTransaction.customerName && (
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        Customer
                      </p>
                      <p className="font-medium text-text dark:text-dark-text">
                        {selectedTransaction.customerName}
                      </p>
                    </div>
                  )}
                  {selectedTransaction.paymentMethod && (
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">
                        Payment Method
                      </p>
                      <p className="font-medium text-text dark:text-dark-text">
                        {selectedTransaction.paymentMethod}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedTransaction.notes && (
                <div>
                  <h4 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
                    Notes
                  </h4>
                  <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                    <p className="text-text dark:text-dark-text">
                      {selectedTransaction.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-surface-muted dark:border-dark-surface-muted">
                <button
                  onClick={() => handleDownloadReceipt(selectedTransaction)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Receipt
                </button>
                <button
                  onClick={() => {
                    setShowTransactionDetails(false);
                    setSelectedTransaction(null);
                  }}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal History Modal */}
      {showWithdrawalHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text dark:text-dark-text">
                  Withdrawal History
                </h2>
                <button
                  onClick={() => setShowWithdrawalHistory(false)}
                  className="p-2 text-error hover:bg-error/10 rounded-md"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {withdrawalHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted dark:text-dark-muted mx-auto mb-4" />
                  <p className="text-muted dark:text-dark-muted">
                    No withdrawal history available
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawalHistory.map((withdrawal) => (
                    <div
                      key={withdrawal.id}
                      className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              withdrawal.instantWithdrawal
                                ? "bg-orange-100 dark:bg-orange-900/30"
                                : "bg-blue-100 dark:bg-blue-900/30"
                            }`}
                          >
                            <ArrowUpRight
                              className={`w-5 h-5 ${withdrawal.instantWithdrawal ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"}`}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-text dark:text-dark-text">
                              {withdrawal.instantWithdrawal
                                ? "Instant Withdrawal"
                                : "Standard Withdrawal"}
                            </h3>
                            <p className="text-sm text-muted dark:text-dark-muted">
                              {format(new Date(withdrawal.createdAt), "PPPpp")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-text dark:text-dark-text">
                            ₦{withdrawal.amount.toLocaleString()}
                          </p>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getWithdrawalStatusColor(withdrawal.status)}`}
                          >
                            {withdrawal.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted dark:text-dark-muted">
                            Bank Account
                          </p>
                          <p className="font-medium text-text dark:text-dark-text">
                            {withdrawal.bankName} - {withdrawal.accountName}
                          </p>
                          <p className="text-muted dark:text-dark-muted">
                            ****{withdrawal.accountNumber.slice(-4)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted dark:text-dark-muted">
                            Processing Details
                          </p>
                          <p className="font-medium text-text dark:text-dark-text">
                            Fee: ₦{withdrawal.fee.toLocaleString()}
                          </p>
                          <p className="text-muted dark:text-dark-muted">
                            Total: ₦{withdrawal.totalAmount.toLocaleString()}
                          </p>
                          <p className="text-muted dark:text-dark-muted">
                            Est. time: {withdrawal.estimatedProcessingTime}
                          </p>
                        </div>
                      </div>

                      {withdrawal.status === "PENDING" && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() =>
                              handleCancelWithdrawal(withdrawal.id)
                            }
                            className="px-3 py-1 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Cancel Withdrawal
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Withdrawal Summary */}
              <div className="mt-6 pt-6 border-t border-surface-muted dark:border-dark-surface-muted">
                <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
                  Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Total Withdrawn
                    </p>
                    <p className="text-xl font-bold text-text dark:text-dark-text">
                      ₦
                      {withdrawalHistory
                        .reduce(
                          (sum, w) =>
                            w.status === "COMPLETED" ? sum + w.amount : sum,
                          0,
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Pending Withdrawals
                    </p>
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                      ₦
                      {withdrawalHistory
                        .reduce(
                          (sum, w) =>
                            w.status === "PENDING" || w.status === "PROCESSING"
                              ? sum + w.amount
                              : sum,
                          0,
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Total Fees Paid
                    </p>
                    <p className="text-xl font-bold text-text dark:text-dark-text">
                      ₦
                      {withdrawalHistory
                        .reduce((sum, w) => sum + w.fee, 0)
                        .toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Process Refund
              </h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  value={refundForm.orderId}
                  onChange={(e) =>
                    setRefundForm({ ...refundForm, orderId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  placeholder="Enter order ID"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Refund Type
                </label>
                <select
                  value={refundForm.type}
                  onChange={(e) =>
                    setRefundForm({ ...refundForm, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                >
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Refund Amount (₦)
                </label>
                <input
                  type="number"
                  value={refundForm.amount}
                  onChange={(e) =>
                    setRefundForm({ ...refundForm, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  placeholder="Enter amount"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Reason
                </label>
                <select
                  value={refundForm.reason}
                  onChange={(e) =>
                    setRefundForm({ ...refundForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                >
                  <option value="">Select reason</option>
                  <option value="food_quality">Product Quality Issue</option>
                  <option value="wrong_order">Wrong Order Delivered</option>
                  <option value="late_delivery">Late Delivery</option>
                  <option value="damaged_packaging">Damaged Packaging</option>
                  <option value="customer_request">Customer Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Description
                </label>
                <textarea
                  value={refundForm.description}
                  onChange={(e) =>
                    setRefundForm({
                      ...refundForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  rows={3}
                  placeholder="Provide additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Process Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund History Modal */}
      {showRefundHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Refund History
              </h3>
              <button
                onClick={() => setShowRefundHistory(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {refunds.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted dark:text-dark-muted mx-auto mb-4" />
                <p className="text-muted dark:text-dark-muted">
                  No refunds processed yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {refunds.map((refund) => (
                  <div
                    key={refund.id}
                    className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text dark:text-dark-text">
                            Order #{refund.orderId}
                          </h3>
                          <p className="text-sm text-muted dark:text-dark-muted">
                            {format(new Date(refund.createdAt), "PPPpp")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-text dark:text-dark-text">
                          ₦{refund.amount.toLocaleString()}
                        </p>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getRefundStatusColor(refund.status)}`}
                        >
                          {refund.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted dark:text-dark-muted">
                          Customer
                        </p>
                        <p className="font-medium text-text dark:text-dark-text">
                          {refund.customerName}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted dark:text-dark-muted">
                          Reason
                        </p>
                        <p className="font-medium text-text dark:text-dark-text">
                          {refund.reason.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    {refund.description && (
                      <div className="mt-3 text-sm">
                        <p className="text-muted dark:text-dark-muted">
                          Description
                        </p>
                        <p className="text-text dark:text-dark-text">
                          {refund.description}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleViewRefund(refund)}
                        className="px-3 py-1 text-sm border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        View Details
                      </button>
                      {refund.status === "PENDING" && (
                        <>
                          <button
                            onClick={() =>
                              handleProcessRefund(refund.id, "approve")
                            }
                            className="px-3 py-1 text-sm border border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              handleProcessRefund(refund.id, "reject")
                            }
                            className="px-3 py-1 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disputes Modal */}
      {showDisputes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Dispute Management
              </h3>
              <button
                onClick={() => setShowDisputes(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <button
                onClick={() => setShowDisputeModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create New Dispute
              </button>
            </div>

            {disputes.length === 0 ? (
              <div className="text-center py-8">
                <Flag className="w-12 h-12 text-muted dark:text-dark-muted mx-auto mb-4" />
                <p className="text-muted dark:text-dark-muted">
                  No disputes filed yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {disputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <Flag className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text dark:text-dark-text">
                            Transaction #{dispute.transactionId}
                          </h3>
                          <p className="text-sm text-muted dark:text-dark-muted">
                            {format(new Date(dispute.createdAt), "PPPpp")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getDisputeStatusColor(dispute.status)}`}
                      >
                        {dispute.status}
                      </span>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted dark:text-dark-muted">
                        Category
                      </p>
                      <p className="font-medium text-text dark:text-dark-text">
                        {dispute.category}
                      </p>
                    </div>

                    <div className="mt-3 text-sm">
                      <p className="text-muted dark:text-dark-muted">Reason</p>
                      <p className="text-text dark:text-dark-text">
                        {dispute.reason}
                      </p>
                    </div>

                    {dispute.evidence && dispute.evidence.length > 0 && (
                      <div className="mt-3 text-sm">
                        <p className="text-muted dark:text-dark-muted">
                          Evidence Files
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {dispute.evidence.map((file, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-surface-muted dark:bg-dark-surface-muted rounded text-xs"
                            >
                              {file.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleViewDispute(dispute)}
                        className="px-3 py-1 text-sm border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispute Creation Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Create Dispute
              </h3>
              <button
                onClick={() => setShowDisputeModal(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDispute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={disputeForm.transactionId}
                  onChange={(e) =>
                    setDisputeForm({
                      ...disputeForm,
                      transactionId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  placeholder="Enter transaction ID"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Category
                </label>
                <select
                  value={disputeForm.category}
                  onChange={(e) =>
                    setDisputeForm({ ...disputeForm, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                >
                  <option value="payment">Payment Issue</option>
                  <option value="order">Order Dispute</option>
                  <option value="delivery">Delivery Problem</option>
                  <option value="quality">Quality Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Reason
                </label>
                <textarea
                  value={disputeForm.reason}
                  onChange={(e) =>
                    setDisputeForm({ ...disputeForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  rows={3}
                  placeholder="Describe the issue..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Detailed Description
                </label>
                <textarea
                  value={disputeForm.description}
                  onChange={(e) =>
                    setDisputeForm({
                      ...disputeForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  rows={4}
                  placeholder="Provide detailed explanation..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Evidence Files
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  accept="image/*,.pdf,.doc,.docx"
                />
                {disputeForm.evidence.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {disputeForm.evidence.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted dark:text-dark-muted">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEvidenceFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Create Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Details Modal */}
      {showDisputeDetails && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Dispute Details
              </h3>
              <button
                onClick={() => setShowDisputeDetails(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Dispute Information */}
              <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                <h4 className="font-semibold text-text dark:text-dark-text mb-3">
                  Dispute Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted dark:text-dark-muted">
                      Transaction ID
                    </p>
                    <p className="font-medium text-text dark:text-dark-text">
                      #{selectedDispute.transactionId}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted dark:text-dark-muted">Status</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getDisputeStatusColor(selectedDispute.status)}`}
                    >
                      {selectedDispute.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-muted dark:text-dark-muted">Category</p>
                    <p className="font-medium text-text dark:text-dark-text">
                      {selectedDispute.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted dark:text-dark-muted">
                      Created Date
                    </p>
                    <p className="font-medium text-text dark:text-dark-text">
                      {format(new Date(selectedDispute.createdAt), "PPPpp")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dispute Reason */}
              <div>
                <h4 className="font-semibold text-text dark:text-dark-text mb-2">
                  Dispute Reason
                </h4>
                <p className="text-text dark:text-dark-text">
                  {selectedDispute.reason}
                </p>
              </div>

              {/* Detailed Description */}
              {selectedDispute.description && (
                <div>
                  <h4 className="font-semibold text-text dark:text-dark-text mb-2">
                    Detailed Description
                  </h4>
                  <p className="text-text dark:text-dark-text">
                    {selectedDispute.description}
                  </p>
                </div>
              )}

              {/* Evidence Files */}
              {selectedDispute.evidence &&
                selectedDispute.evidence.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-text dark:text-dark-text mb-2">
                      Evidence Files
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedDispute.evidence.map((file, index) => (
                        <div
                          key={index}
                          className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Upload className="w-4 h-4 text-muted dark:text-dark-muted" />
                              <span className="text-sm text-text dark:text-dark-text">
                                {file.name}
                              </span>
                            </div>
                            <button
                              onClick={() => window.open(file.url, "_blank")}
                              className="text-primary hover:text-primary/90 text-sm"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Communication Thread */}
              <div>
                <h4 className="font-semibold text-text dark:text-dark-text mb-3">
                  Communication
                </h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {selectedDispute.responses &&
                  selectedDispute.responses.length > 0 ? (
                    selectedDispute.responses.map((response) => (
                      <div
                        key={response.id}
                        className={`flex ${response.sender === "merchant" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            response.sender === "merchant"
                              ? "bg-primary text-white"
                              : "bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text"
                          }`}
                        >
                          <p className="text-sm">{response.message}</p>
                          <p
                            className={`text-xs mt-1 ${
                              response.sender === "merchant"
                                ? "text-white/80"
                                : "text-muted dark:text-dark-muted"
                            }`}
                          >
                            {format(new Date(response.timestamp), "PPp")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted dark:text-dark-muted text-sm">
                      No communication yet
                    </p>
                  )}
                </div>

                {/* Add Response */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your response..."
                    className="flex-1 px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddDisputeResponse(selectedDispute.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleAddDisputeResponse(selectedDispute.id)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Resolution Actions */}
              {selectedDispute.status !== "RESOLVED" &&
                selectedDispute.status !== "CLOSED" && (
                  <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                    <h4 className="font-semibold text-text dark:text-dark-text mb-3">
                      Resolution Actions
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedDispute.status === "OPEN" && (
                        <button
                          onClick={() => {
                            const updatedDisputes = disputes.map((d) =>
                              d.id === selectedDispute.id
                                ? {
                                    ...d,
                                    status: "UNDER_REVIEW",
                                    reviewedAt: new Date().toISOString(),
                                  }
                                : d,
                            );
                            setDisputes(updatedDisputes);
                            setSelectedDispute({
                              ...selectedDispute,
                              status: "UNDER_REVIEW",
                              reviewedAt: new Date().toISOString(),
                            });
                            showSuccessToast("Dispute marked as under review");
                          }}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          Mark as Under Review
                        </button>
                      )}

                      {selectedDispute.status === "UNDER_REVIEW" && (
                        <>
                          <button
                            onClick={() => {
                              const resolution = prompt(
                                "Enter resolution details:",
                              );
                              if (resolution) {
                                const updatedDisputes = disputes.map((d) =>
                                  d.id === selectedDispute.id
                                    ? {
                                        ...d,
                                        status: "RESOLVED",
                                        resolvedAt: new Date().toISOString(),
                                        resolution: resolution,
                                      }
                                    : d,
                                );
                                setDisputes(updatedDisputes);
                                setSelectedDispute({
                                  ...selectedDispute,
                                  status: "RESOLVED",
                                  resolvedAt: new Date().toISOString(),
                                  resolution: resolution,
                                });
                                showSuccessToast(
                                  "Dispute resolved successfully",
                                );
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Resolve Dispute
                          </button>

                          <button
                            onClick={() => {
                              const reason = prompt(
                                "Enter reason for closure:",
                              );
                              if (reason) {
                                const updatedDisputes = disputes.map((d) =>
                                  d.id === selectedDispute.id
                                    ? {
                                        ...d,
                                        status: "CLOSED",
                                        closedAt: new Date().toISOString(),
                                        closureReason: reason,
                                      }
                                    : d,
                                );
                                setDisputes(updatedDisputes);
                                setSelectedDispute({
                                  ...selectedDispute,
                                  status: "CLOSED",
                                  closedAt: new Date().toISOString(),
                                  closureReason: reason,
                                });
                                showSuccessToast("Dispute closed");
                              }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Close Dispute
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          const note = prompt("Add internal note:");
                          if (note) {
                            const updatedDisputes = disputes.map((d) =>
                              d.id === selectedDispute.id
                                ? {
                                    ...d,
                                    internalNotes: [
                                      ...(d.internalNotes || []),
                                      {
                                        note: note,
                                        timestamp: new Date().toISOString(),
                                      },
                                    ],
                                  }
                                : d,
                            );
                            setDisputes(updatedDisputes);
                            setSelectedDispute({
                              ...selectedDispute,
                              internalNotes: [
                                ...(selectedDispute.internalNotes || []),
                                {
                                  note: note,
                                  timestamp: new Date().toISOString(),
                                },
                              ],
                            });
                            showSuccessToast("Internal note added");
                          }
                        }}
                        className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                      >
                        Add Internal Note
                      </button>
                    </div>
                  </div>
                )}

              {/* Resolution Details */}
              {(selectedDispute.status === "RESOLVED" ||
                selectedDispute.status === "CLOSED") && (
                <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                  <h4 className="font-semibold text-text dark:text-dark-text mb-3">
                    Resolution Details
                  </h4>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      {selectedDispute.status === "RESOLVED"
                        ? "Dispute Resolved"
                        : "Dispute Closed"}
                    </p>
                    {selectedDispute.resolvedAt && (
                      <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                        {format(new Date(selectedDispute.resolvedAt), "PPPpp")}
                      </p>
                    )}
                    {selectedDispute.resolution && (
                      <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                        {selectedDispute.resolution}
                      </p>
                    )}
                    {selectedDispute.closureReason && (
                      <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                        Reason: {selectedDispute.closureReason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Internal Notes */}
              {selectedDispute.internalNotes &&
                selectedDispute.internalNotes.length > 0 && (
                  <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                    <h4 className="font-semibold text-text dark:text-dark-text mb-3">
                      Internal Notes
                    </h4>
                    <div className="space-y-2">
                      {selectedDispute.internalNotes.map((note, index) => (
                        <div
                          key={index}
                          className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-3"
                        >
                          <p className="text-sm text-text dark:text-dark-text">
                            {note.note}
                          </p>
                          <p className="text-xs text-muted dark:text-dark-muted mt-1">
                            {format(new Date(note.timestamp), "PPp")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Generation Modal */}
      {showCustomReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Generate Custom Report
              </h3>
              <button
                onClick={() => setShowCustomReportModal(false)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                generateCustomReport();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={customReport.name}
                  onChange={(e) =>
                    setCustomReport({ ...customReport, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  placeholder="Enter report name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                    Data Type
                  </label>
                  <select
                    value={customReport.type}
                    onChange={(e) =>
                      setCustomReport({ ...customReport, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  >
                    <option value="transaction">Transactions</option>
                    <option value="refund">Refunds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
                    Format
                  </label>
                  <select
                    value={customReport.format}
                    onChange={(e) =>
                      setCustomReport({
                        ...customReport,
                        format: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text"
                  >
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Select Fields to Include
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customReport.type === "transaction" && (
                    <>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.date}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                date: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Date
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.type}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                type: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Type
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.amount}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                amount: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Amount
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.status}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                status: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Status
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.commission}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                commission: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Commission
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.tax}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                tax: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Tax
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.orderId}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                orderId: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Order ID
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.description}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                description: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Description
                      </label>
                    </>
                  )}

                  {customReport.type === "refund" && (
                    <>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.date}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                date: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Date
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.orderId}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                orderId: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Order ID
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.amount}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                amount: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Amount
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.status}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                status: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Status
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.description}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                description: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Description
                      </label>
                    </>
                  )}

                  {customReport.type === "dispute" && (
                    <>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.date}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                date: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Date
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.orderId}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                orderId: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Transaction ID
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.status}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                status: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Status
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={customReport.fields.description}
                          onChange={(e) =>
                            setCustomReport({
                              ...customReport,
                              fields: {
                                ...customReport.fields,
                                description: e.target.checked,
                              },
                            })
                          }
                          className="mr-2"
                        />
                        Description
                      </label>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Additional Filters
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted dark:text-dark-muted mb-1">
                      Status
                    </label>
                    <select
                      value={customReport.filters.status}
                      onChange={(e) =>
                        setCustomReport({
                          ...customReport,
                          filters: {
                            ...customReport.filters,
                            status: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text text-sm"
                    >
                      <option value="all">All</option>
                      <option value="PENDING">Pending</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="FAILED">Failed</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted dark:text-dark-muted mb-1">
                      Min Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={customReport.filters.minAmount}
                      onChange={(e) =>
                        setCustomReport({
                          ...customReport,
                          filters: {
                            ...customReport.filters,
                            minAmount: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text text-sm"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted dark:text-dark-muted mb-1">
                      Max Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={customReport.filters.maxAmount}
                      onChange={(e) =>
                        setCustomReport({
                          ...customReport,
                          filters: {
                            ...customReport.filters,
                            maxAmount: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary dark:bg-dark-surface-muted dark:text-dark-text text-sm"
                      placeholder="No limit"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCustomReportModal(false)}
                  className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Generate Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
