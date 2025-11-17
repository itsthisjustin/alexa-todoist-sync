# Pricing Strategy Guide

## Tiered Pricing Model

### Free Tier ($0/month)
**Target:** Casual users, trial users
- Amazon → Todoist: Every 60 minutes
- Todoist → Amazon: Once per day
- **Cost to you:** ~$0.09/month per user
- **Margin:** Break-even on infrastructure

**User Value:** Try the service, good for casual shopping list users

### Pro Tier ($5/month)
**Target:** Regular users who want faster syncs
- Amazon → Todoist: Every 15 minutes
- Todoist → Amazon: Every 6 hours
- **Cost to you:** ~$0.36/month per user
- **Margin:** $4.64 per user (92.8%)

**User Value:** Near real-time syncing for active Alexa users

### Premium Tier ($15/month)
**Target:** Power users, business users
- Amazon → Todoist: Every 5 minutes
- Todoist → Amazon: Every hour
- **Cost to you:** ~$1.08/month per user
- **Margin:** $13.92 per user (92.8%)

**User Value:** Instant syncing, full automation

## Cost Breakdown (per user/month)

| Tier | Alexa Syncs | Browser Hours | Cost | Revenue | Margin |
|------|-------------|---------------|------|---------|--------|
| Free | 720 | 2.0 | $0.09 | $0 | -$0.09 |
| Pro | 2,880 | 8.0 | $0.36 | $5 | $4.64 |
| Premium | 8,640 | 24.0 | $1.08 | $15 | $13.92 |

*Assumes 10 seconds per sync*

## Revenue Projections

### Scenario: 1,000 active users

| Distribution | Free | Pro | Premium | Monthly Revenue | Monthly Costs | Profit |
|--------------|------|-----|---------|-----------------|---------------|--------|
| **Conservative** | 700 | 250 | 50 | $2,000 | $153 | $1,847 |
| **Realistic** | 500 | 400 | 100 | $3,500 | $225 | $3,275 |
| **Optimistic** | 300 | 500 | 200 | $5,500 | $297 | $5,203 |

### Path to 100 Users (Month 1-3)
- Target: 70 free, 25 pro, 5 premium
- Revenue: $200/month
- Costs: ~$15/month
- **Profit: $185/month**

### Path to 1,000 Users (Month 6-12)
- Target: 500 free, 400 pro, 100 premium
- Revenue: $3,500/month
- Costs: ~$225/month
- **Profit: $3,275/month**

## Conversion Strategy

### Free → Pro Upgrade Triggers
1. **Limitation notification**: "Your sync is delayed by up to 60 minutes. Upgrade to Pro for 15-minute syncs!"
2. **Usage patterns**: If user logs in frequently, suggest faster syncs
3. **Free trial**: Offer 7-day Pro trial to new users

### Pro → Premium Upgrade Triggers
1. **Power user detection**: If they add >10 items/day
2. **Business use case**: Detect team/family sharing patterns
3. **API access**: Offer Premium for API integration

## Pricing Psychology

### Why This Works
- **Free tier**: Low barrier to entry, builds user base
- **$5 Pro**: Psychological sweet spot, feels affordable
- **$15 Premium**: High enough to filter serious users, low enough to convert

### Anchoring Effect
Show all three tiers together → makes $5 seem very reasonable compared to $15

### Value Communication
- **Free**: "Try it out"
- **Pro**: "Best value" (badge/highlight)
- **Premium**: "For power users"

## Future Monetization

### Additional Revenue Streams
1. **Annual plans**: Offer 2 months free (20% discount)
2. **API access**: Premium + API = $25/month
3. **White label**: Enterprise tier at $99/month
4. **Affiliate**: Todoist affiliate links

### Cost Optimization
As you grow, negotiate with Cloudflare:
- Bulk browser hours discount
- Enterprise support plan
- Potentially move to hybrid (Cloudflare + VPS) if >10,000 users

## Recommended Launch Strategy

### Phase 1: MVP (Month 1-2)
- Launch with all 3 tiers
- Make free tier actually useful (60min is reasonable)
- Focus on getting 100 free users

### Phase 2: Conversion (Month 3-6)
- Add conversion prompts
- Email campaigns: "You've synced 500 items! Upgrade for faster syncs"
- Social proof: "X users upgraded this week"

### Phase 3: Scale (Month 6+)
- Optimize pricing based on data
- Add annual plans
- Launch enterprise tier

## Key Metrics to Track

1. **Free → Pro conversion rate** (target: 30%)
2. **Pro → Premium conversion rate** (target: 20%)
3. **Churn rate** (target: <5% monthly)
4. **Average revenue per user (ARPU)** (target: $3-5)
5. **Customer acquisition cost (CAC)** (keep < $10)

## Pricing Page Copy

### Free
**Perfect for trying it out**
- Sync every hour
- No credit card required
- Cancel anytime

### Pro ⭐ MOST POPULAR
**Best for active users**
- Sync every 15 minutes
- Near real-time updates
- Priority support

### Premium
**For power users**
- Sync every 5 minutes
- Instant automation
- Premium support & API access

---

**Bottom line:** With good conversion rates (30% to Pro, 20% to Premium), you can be profitable with just 100 users and scale to $5k+/month with 1,000 users.
