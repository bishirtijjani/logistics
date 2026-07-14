# Monitoring delivery requests

The **Requests** page is the live and historical record of every delivery order
on the platform - food, groceries, pharmacy, and packages.

![Delivery requests](/help/screenshots/admin/requests.png)

---

## At a glance

The tiles at the top show the live workload: **active requests**, orders still
**awaiting a rider**, and today's **delivered** and **cancelled** counts. Turn
on **Auto-refresh** to keep the page updating every 30 seconds while you
monitor operations.

---

## What you'll see

Each request shows its **customer**, **merchant** (if any), **status**, **total**,
and **time**. An order moves through these stages:

**Requested → Accepted → Processing → Ready for Pickup → Rider Assigned →
Rider en Route → Picked up → In transit → Delivered → Settled** (or
**Cancelled**).

Active orders also show their **age** - how long since they were placed. An
order sitting without a rider turns amber after 30 minutes and red after an
hour, so stuck orders stand out.

Use the **search box** to find an order by **request ID, customer name, phone,
or email, merchant, or rider**, and combine it with the status, type, category,
and date filters. **Export CSV** downloads the full filtered result set, not
just the visible page.

---

## Look into an order

Click a request to see the full picture - items, the customer and merchant,
delivery address, the assigned rider, the money split (subtotal, delivery fee,
platform fee, discounts, and the merchant/rider/platform earnings), proof of
delivery, and a **timeline** of every lifecycle step with timestamps.
Customer names link straight to their profile.

> 💡 When a customer or merchant contacts support about an order, find it here
> first - it shows exactly where the order is and who's involved.

---

## Intervene in an order

Three actions are available on any order that isn't delivered or cancelled:

- **Mark as [next status]** - move a stuck order one step along its normal
  lifecycle (for example, a merchant forgot to mark an order ready). The
  customer is notified and downstream automation - rider matching,
  settlement - runs as usual. The change is recorded in the audit log.
- **Assign / Reassign Rider** - hand the delivery to a different approved
  rider.
- **Force Cancel** - cancel an order that genuinely can't be completed.

## Cancel an order

If an order is stuck or needs intervention, you can **cancel** it. You'll be
asked for a **cancellation reason** - this is recorded in the audit log, and
wallet payments are refunded to the customer automatically.

> ⚠️ Cancelling refunds the customer and affects the merchant and rider.
> Only do it when an order genuinely can't be completed, and always give a clear
> reason.

---

**Next:** [Resolving disputes](/help/admin/resolving-disputes) ·
[Finances & transactions](/help/admin/finance)
