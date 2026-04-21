import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { colors } from "../../theme";
import { rateDelivery } from "../../store/slices/deliverySlice";

const QUICK_TAGS = [
  { id: "fast", label: "Fast Delivery", icon: "time-outline" },
  { id: "friendly", label: "Friendly", icon: "happy-outline" },
  { id: "careful", label: "Careful Handling", icon: "shield-checkmark-outline" },
  { id: "professional", label: "Professional", icon: "business-outline" },
  { id: "ontime", label: "On Time", icon: "checkmark-circle-outline" },
];

export default function RateDeliveryScreen({ navigation, route }) {
  const { orderId, riderId } = route.params;
  const dispatch = useDispatch();

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a star rating");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const reviewText = comment.trim() || selectedTags.map((t) => QUICK_TAGS.find((tag) => tag.id === t)?.label).join(", ");

      await dispatch(
        rateDelivery({
          orderId,
          ratingData: {
            score: rating,
            comment: reviewText,
          },
        })
      ).unwrap();

      // Show success and navigate back
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err) {
      setError(err.message || "Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Rate Delivery</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        {/* Success Icon */}
        <View style={{ alignItems: "center", marginTop: 20, marginBottom: 24 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.success + "20",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 }}>
            Delivery Complete!
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            How was your delivery experience?
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View
            style={{
              backgroundColor: colors.error + "15",
              borderRadius: 12,
              padding: 12,
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Star Rating */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16 }}>
            Tap to rate
          </Text>
          <View style={{ flexDirection: "row" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={{ marginHorizontal: 4 }}
              >
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={40}
                  color={star <= rating ? "#F59E0B" : colors.textLight}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ marginTop: 12, fontSize: 14, color: colors.textMuted }}>
            {rating === 0 && "Select a rating"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </Text>
        </View>

        {/* Quick Tags */}
        {rating > 0 && (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>
              Quick Tags
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
              {QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: selectedTags.includes(tag.id) ? colors.primary : colors.surface,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    marginRight: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: selectedTags.includes(tag.id) ? colors.primary : colors.border,
                  }}
                >
                  <Ionicons
                    name={tag.icon}
                    size={14}
                    color={selectedTags.includes(tag.id) ? colors.white : colors.textMuted}
                  />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      fontWeight: "600",
                      color: selectedTags.includes(tag.id) ? colors.white : colors.text,
                    }}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Comment */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          Additional Comments (Optional)
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Tell us more about your experience..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={4}
            style={{
              fontSize: 15,
              color: colors.text,
              fontWeight: "500",
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 24,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || rating === 0}
          style={{
            backgroundColor: rating === 0 ? colors.textLight : colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
              Submit Rating
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
