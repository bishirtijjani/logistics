-- Premium search: hybrid full-text + trigram retrieval.
--
-- The Phase 6 search only ran whole-string pg_trgm similarity() on
-- merchant.name / product.name. That misses words buried in long names
-- ("shoe" inside "Men's Leather Derby Shoe"), multi-word / out-of-order
-- queries ("lady m combo meal"), and anything living in descriptions,
-- categories or tags. This migration adds:
--
--   1. Generated `search_vector` tsvector columns (Postgres maintains them
--      automatically) so we can token-match with full-text search.
--   2. GIN indexes on those vectors for the indexed fast path.
--   3. Trigram GIN indexes on descriptions so word_similarity() can fuzzy
--      match typos/substrings beyond the name.
--
-- We use the 'simple' text-search config (no stemming / stopword removal) so
-- brand tokens like "crocs" or single letters like the "m" in "Lady M" are
-- never dropped; typo/plural tolerance is handled separately by word_similarity.

-- ── Merchants: name (weight A) + description (weight B) ──────────────────────
ALTER TABLE "merchants"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "merchants_search_vector_idx"
  ON "merchants" USING GIN ("search_vector");

-- ── Products: name (A) + description (B) + free-text category (C) ────────────
ALTER TABLE "products"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("category", '')), 'C')
  ) STORED;

CREATE INDEX "products_search_vector_idx"
  ON "products" USING GIN ("search_vector");

-- ── Widen trigram (word_similarity) coverage to descriptions ─────────────────
-- The existing *_name_trgm_idx already cover names. Adding descriptions lets a
-- buried brand/keyword in the blurb still surface via word_similarity().
CREATE INDEX IF NOT EXISTS "merchants_description_trgm_idx"
  ON "merchants" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_description_trgm_idx"
  ON "products" USING GIN ("description" gin_trgm_ops);
