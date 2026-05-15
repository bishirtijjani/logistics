-- Add optional imageUrl + description to ProductOptionItem so merchants can
-- attach a Cloudinary photo and a short tagline to add-ons (sides, spice
-- levels, etc.). Both nullable so existing rows are unaffected.

ALTER TABLE "product_option_items" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "product_option_items" ADD COLUMN "description" TEXT;
