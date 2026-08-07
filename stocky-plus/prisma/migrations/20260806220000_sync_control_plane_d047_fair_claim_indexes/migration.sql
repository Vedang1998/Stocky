-- D-047 / F-PR4-11: shop-leading claim indexes including id so ORDER BY
-- ("shopId","nextEligibleAt","createdAt",id) LIMIT N uses Index/Index Only Scan
-- without re-sorting the eligible backlog (bounded per-shop LATERAL fair claim).

CREATE INDEX IF NOT EXISTS "DurableJob_shop_claim_pending_idx"
  ON "DurableJob" ("shopId", "nextEligibleAt" ASC, "createdAt" ASC, id ASC)
  WHERE state = 'PENDING';

CREATE INDEX IF NOT EXISTS "DurableJob_shop_claim_retry_wait_idx"
  ON "DurableJob" ("shopId", "nextEligibleAt" ASC, "createdAt" ASC, id ASC)
  WHERE state = 'RETRY_WAIT';
