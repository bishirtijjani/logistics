import { useState, useEffect } from "react";
import { API_URL } from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import {
  Store,
  User,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "../utils/toast.js";
import SearchableSelect from "../components/SearchableSelect.jsx";

export default function RegistrationPage({ enroll = false }) {
  const navigate = useNavigate();
  // Enroll mode: an already-logged-in user (customer/rider) is adding a
  // merchant profile to their existing account. We skip the personal-info step
  // and the email OTP entirely - they're already verified - and POST only the
  // business fields to /auth/merchant/enroll with their bearer token.
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("merchant_user") || "null");
    } catch {
      return null;
    }
  })();
  const [currentStep, setCurrentStep] = useState(enroll ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [personalErrors, setPersonalErrors] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    categoryId: "",
    businessPhone: "",
    businessEmail: "",
    openingTime: "08:00",
    closingTime: "22:00",
  });

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const res = await fetch(`${API_URL}/categories`);
      if (!res.ok) throw new Error("Failed to load categories");
      const json = await res.json();
      setCategories(json.data || []);
    } catch (e) {
      setCategoriesError(e.message || "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Resend-OTP cooldown countdown. Driving this from useEffect (instead of a
  // setInterval started inside handleResendOtp) means the timer is torn down
  // automatically if the user navigates away mid-cooldown - the old
  // implementation kept ticking on an unmounted component and called
  // setResendCooldown after unmount.
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = setTimeout(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const [businessErrors, setBusinessErrors] = useState({
    businessName: "",
    businessPhone: "",
    businessEmail: "",
  });

  const validatePersonalInfo = () => {
    const errors = {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    };
    let isValid = true;

    if (!personalInfo.firstName) {
      errors.firstName = "Please enter your first name";
      isValid = false;
    }
    if (!personalInfo.lastName) {
      errors.lastName = "Please enter your last name";
      isValid = false;
    }
    if (
      !personalInfo.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)
    ) {
      errors.email = "Please enter a valid email address";
      isValid = false;
    }
    if (!personalInfo.phone || !/^0[789][01]\d{8}$/.test(personalInfo.phone)) {
      errors.phone = "Please enter a valid Nigerian phone number";
      isValid = false;
    }
    if (!personalInfo.password || personalInfo.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
      isValid = false;
    }
    if (personalInfo.password !== personalInfo.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    setPersonalErrors(errors);
    return isValid;
  };

  const validateBusinessInfo = () => {
    const errors = {
      businessName: "",
      businessPhone: "",
      businessEmail: "",
    };
    let isValid = true;

    if (!businessInfo.businessName) {
      errors.businessName = "Please enter your business name";
      isValid = false;
    }
    if (!businessInfo.categoryId) {
      showErrorToast("Please pick a business category");
      isValid = false;
    }
    if (!businessInfo.businessPhone) {
      errors.businessPhone = "Please enter your business phone number";
      isValid = false;
    }
    if (
      !businessInfo.businessEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessInfo.businessEmail)
    ) {
      errors.businessEmail = "Please enter a valid business email";
      isValid = false;
    }

    setBusinessErrors(errors);
    return isValid;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validatePersonalInfo()) return;
    if (currentStep === 2 && !validateBusinessInfo()) return;
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(Math.max(currentStep - 1, enroll ? 2 : 1));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (enroll) {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/auth/merchant/enroll`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...businessInfo }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Could not create your business");
        }
        // Persist the new merchantId so the dashboard's merchant-scoped pages
        // work immediately, without forcing a re-login.
        try {
          const merged = {
            ...(storedUser || {}),
            merchantId: data?.data?.merchantId,
            role: "MERCHANT",
          };
          localStorage.setItem("merchant_user", JSON.stringify(merged));
        } catch {
          // ignore storage errors
        }
        showSuccessToast("Business created! It's now pending admin approval.");
        // Hard navigation so the Redux store re-hydrates from localStorage with
        // the new merchantId - a client-side route change would leave
        // state.auth.user.merchantId null and break merchant-scoped pages.
        window.location.assign("/dashboard");
        return;
      }

      const response = await fetch(`${API_URL}/auth/merchant/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...personalInfo,
          ...businessInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      if (data.success) {
        setVerificationSent(true);
        showSuccessToast(
          "Registration successful! Please check your email for verification code.",
        );
      }
    } catch (err) {
      showErrorToast(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter a valid 6-digit verification code");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      const response = await fetch(`${API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: personalInfo.email,
          code: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed");
      }

      if (data.success) {
        showSuccessToast(
          "Email verified successfully! Your account is now pending admin approval.",
        );
        navigate("/login");
      }
    } catch (err) {
      setOtpError(err.message || "Verification failed");
      showErrorToast(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setOtpError("");

    try {
      const response = await fetch(`${API_URL}/auth/otp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: personalInfo.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend code");
      }

      if (data.success) {
        showSuccessToast("Verification code sent to your email");
        setResendCooldown(60);
        // The useEffect on resendCooldown above drives the countdown and
        // cleans up the timer on unmount.
      }
    } catch (err) {
      setOtpError(err.message || "Failed to resend code");
      showErrorToast(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-surface-muted dark:bg-dark-surface-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-surface dark:bg-dark-surface rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text dark:text-dark-text mb-2">
                Verify Your Email
              </h2>
              <p className="text-muted dark:text-dark-muted">
                Enter the 6-digit code sent to {personalInfo.email}
              </p>
            </div>

            {otpError && (
              <div className="mb-6 p-4 bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                <p className="text-sm text-error">{otpError}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Verifying..." : "Verify Email"}
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="w-full py-3 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
              </button>

              <button
                onClick={() => setVerificationSent(false)}
                className="w-full py-3 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors"
              >
                Back to Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-dark-background flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 shadow-lg">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1
            className="text-4xl font-bold text-text dark:text-dark-text mb-2"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            {enroll ? "Register your business" : "Join Logistics Platform"}
          </h1>
          <p className="text-muted dark:text-dark-muted">
            {enroll
              ? "Add a merchant profile to your existing Logistics Platform account"
              : "Start delivering your products to customers in Katsina"}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {(enroll ? [2, 3] : [1, 2, 3]).map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  currentStep === step
                    ? "bg-primary text-white"
                    : currentStep > step
                      ? "bg-success text-white"
                      : "bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted"
                }`}
              >
                {currentStep > step ? <Check className="w-5 h-5" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-24 h-1 mx-2 rounded ${
                    currentStep > step
                      ? "bg-success"
                      : "bg-surface-muted dark:bg-dark-surface-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main Form Card */}
        <div className="bg-surface dark:bg-dark-surface rounded-3xl shadow-2xl p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Personal Information
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Tell us about yourself
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={personalInfo.firstName}
                    onChange={(e) => {
                      setPersonalInfo({
                        ...personalInfo,
                        firstName: e.target.value,
                      });
                      setPersonalErrors({ ...personalErrors, firstName: "" });
                    }}
                    placeholder="John"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.firstName ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {personalErrors.firstName && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {personalErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={personalInfo.lastName}
                    onChange={(e) => {
                      setPersonalInfo({
                        ...personalInfo,
                        lastName: e.target.value,
                      });
                      setPersonalErrors({ ...personalErrors, lastName: "" });
                    }}
                    placeholder="Doe"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.lastName ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {personalErrors.lastName && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {personalErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => {
                    setPersonalInfo({ ...personalInfo, email: e.target.value });
                    setPersonalErrors({ ...personalErrors, email: "" });
                  }}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.email ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                />
                {personalErrors.email && (
                  <p className="mt-1 text-sm text-error flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {personalErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(e) => {
                    setPersonalInfo({ ...personalInfo, phone: e.target.value });
                    setPersonalErrors({ ...personalErrors, phone: "" });
                  }}
                  placeholder="08012345678"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.phone ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                />
                {personalErrors.phone && (
                  <p className="mt-1 text-sm text-error flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {personalErrors.phone}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={personalInfo.password}
                    onChange={(e) => {
                      setPersonalInfo({
                        ...personalInfo,
                        password: e.target.value,
                      });
                      setPersonalErrors({ ...personalErrors, password: "" });
                    }}
                    placeholder="Min. 8 characters"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.password ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {personalErrors.password && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {personalErrors.password}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={personalInfo.confirmPassword}
                    onChange={(e) => {
                      setPersonalInfo({
                        ...personalInfo,
                        confirmPassword: e.target.value,
                      });
                      setPersonalErrors({
                        ...personalErrors,
                        confirmPassword: "",
                      });
                    }}
                    placeholder="Re-enter password"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${personalErrors.confirmPassword ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {personalErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {personalErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Business Information
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Tell us about your business
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-3">
                  Business Category
                </label>
                {categoriesError ? (
                  <div className="flex items-center gap-3 text-sm text-error">
                    <AlertCircle className="w-4 h-4" />
                    {categoriesError}
                    <button
                      type="button"
                      onClick={loadCategories}
                      className="text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <SearchableSelect
                    value={businessInfo.categoryId}
                    onChange={(categoryId) =>
                      setBusinessInfo({ ...businessInfo, categoryId })
                    }
                    loading={categoriesLoading && categories.length === 0}
                    placeholder="Select your business category"
                    searchPlaceholder="Search categories…"
                    emptyText="No categories match your search"
                    triggerClassName="w-full flex items-center justify-between gap-2 px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none dark:bg-dark-surface-muted dark:text-dark-text text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    options={categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                      description: cat.description,
                      color: cat.color || "#7C3AED",
                    }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessInfo.businessName}
                  onChange={(e) => {
                    setBusinessInfo({
                      ...businessInfo,
                      businessName: e.target.value,
                    });
                    setBusinessErrors({ ...businessErrors, businessName: "" });
                  }}
                  placeholder="My Restaurant"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${businessErrors.businessName ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                />
                {businessErrors.businessName && (
                  <p className="mt-1 text-sm text-error flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {businessErrors.businessName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={businessInfo.businessPhone}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        businessPhone: e.target.value,
                      });
                      setBusinessErrors({
                        ...businessErrors,
                        businessPhone: "",
                      });
                    }}
                    placeholder="08098765432"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${businessErrors.businessPhone ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {businessErrors.businessPhone && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {businessErrors.businessPhone}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={businessInfo.businessEmail}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        businessEmail: e.target.value,
                      });
                      setBusinessErrors({
                        ...businessErrors,
                        businessEmail: "",
                      });
                    }}
                    placeholder="business@example.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text ${businessErrors.businessEmail ? "border-error focus:border-error" : "border-surface-muted dark:border-dark-surface-muted"}`}
                  />
                  {businessErrors.businessEmail && (
                    <p className="mt-1 text-sm text-error flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {businessErrors.businessEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Operating Hours
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Set your business hours
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={businessInfo.openingTime}
                    onChange={(e) =>
                      setBusinessInfo({
                        ...businessInfo,
                        openingTime: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={businessInfo.closingTime}
                    onChange={(e) =>
                      setBusinessInfo({
                        ...businessInfo,
                        closingTime: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-text dark:text-dark-text mb-1">
                      Approval Required
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Your account will be reviewed by our team before
                      activation. This typically takes 1-2 business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-6">
                <h4 className="font-semibold text-text dark:text-dark-text mb-4">
                  Summary
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">
                      Name:
                    </span>
                    <span className="font-medium text-text dark:text-dark-text">
                      {enroll
                        ? `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`
                        : `${personalInfo.firstName} ${personalInfo.lastName}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">
                      Email:
                    </span>
                    <span className="font-medium text-text dark:text-dark-text">
                      {enroll ? storedUser?.email : personalInfo.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">
                      Business:
                    </span>
                    <span className="font-medium text-text dark:text-dark-text">
                      {businessInfo.businessName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">
                      Category:
                    </span>
                    <span className="font-medium text-text dark:text-dark-text">
                      {categories.find((c) => c.id === businessInfo.categoryId)
                        ?.name || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={loading}
                className="flex-1 py-3 border-2 border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-xl font-semibold hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-success text-white rounded-xl font-semibold hover:bg-success-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? enroll
                    ? "Creating..."
                    : "Creating Account..."
                  : enroll
                    ? "Create business"
                    : "Complete Registration"}
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Login Link */}
          {!enroll && (
            <div className="mt-6 text-center">
              <p className="text-muted dark:text-dark-muted">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:underline font-semibold"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
