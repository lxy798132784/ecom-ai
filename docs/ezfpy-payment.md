# EZFPY Payment Integration

Ecom AI uses 易支付 / EZFPY for credit packs and PRO upgrades.

## Vercel environment variables

Set these in Vercel before production use:

```text
NEXT_PUBLIC_SITE_URL=https://ecom-ai-five.vercel.app
NEXTAUTH_URL=https://ecom-ai-five.vercel.app
EZFPY_BASE_URL=https://www.ezfpy.cn
EZFPY_PID=your merchant pid
EZFPY_KEY=your merchant key
```

Do not commit `EZFPY_KEY` to source code.

## Products

| ID | Name | Price | Effect |
| --- | --- | ---: | --- |
| `credits_50` | 50积分包 | ¥2.00 | add 50 credits |
| `credits_200` | 200积分包 | ¥7.00 | add 200 credits |
| `credits_500` | 500积分包 | ¥18.00 | add 500 credits |
| `pro_monthly` | PRO月付 | ¥75.00 | upgrade user plan to PRO, 2500 monthly credits |

## Payment methods

The first version uses redirect payment via:

```text
https://www.ezfpy.cn/submit.php
```

Supported `type` values:

```text
alipay
wxpay
qqpay
```

## Routes

- `POST /api/pay/ezfpy/create` — authenticated users create an order and receive `payUrl`.
- `GET|POST /api/pay/ezfpy/notify` — EZFPY async notification callback. It verifies MD5 signature, status, pid, amount, and order id before applying credits/PRO.
- `GET /api/pay/ezfpy/order?out_trade_no=...` — authenticated users check their own order status.
- `/pay/result?out_trade_no=...` — customer-facing payment result page.

## Idempotency

Orders are saved in Vercel KV under:

```text
pay:ezfpy:order:{out_trade_no}
```

The notify route applies credits/PRO only when the order is not already `paid`, so repeated EZFPY callbacks do not double-credit the account.
