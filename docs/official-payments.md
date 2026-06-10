# 官方支付宝/微信支付接入说明

本项目现在支持三类支付 provider：

1. 官方支付宝 `alipay`
2. 官方微信支付 V3 `wechat`
3. 易支付备用通道 `ezfpy`

前端会读取 `/api/pay/providers`，只有对应 Vercel 环境变量配置齐全时才启用按钮。

## 支付宝官方支付

### Vercel 环境变量

```env
ALIPAY_APP_ID=你的支付宝开放平台应用ID
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n你的应用私钥_PKCS8\n-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n支付宝公钥\n-----END PUBLIC KEY-----"
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_KEY_TYPE=PKCS8
NEXT_PUBLIC_SITE_URL=https://你的域名
```

### 回调地址

```text
https://你的域名/api/pay/alipay/notify
```

### 返回地址

```text
https://你的域名/pay/result
```

注意：`ALIPAY_PRIVATE_KEY` 是应用私钥，不是支付宝公钥；`ALIPAY_PUBLIC_KEY` 是支付宝公钥，不是应用公钥。

## 微信支付 V3

### Vercel 环境变量

```env
WECHAT_PAY_APPID=微信支付绑定的APPID
WECHAT_PAY_MCH_ID=微信支付商户号
WECHAT_PAY_API_V3_KEY=32位APIv3密钥
WECHAT_PAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n商户API私钥\n-----END PRIVATE KEY-----"
WECHAT_PAY_CERT_SERIAL=商户API证书序列号
WECHAT_PAY_PUBLIC_KEY_ID=微信支付公钥ID_建议配置
WECHAT_PAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n微信支付公钥\n-----END PUBLIC KEY-----"
NEXT_PUBLIC_SITE_URL=https://你的域名
```

### 回调地址

```text
https://你的域名/api/pay/wechat/notify
```

### 支持模式

- `wechat_native`：电脑端展示二维码，用户微信扫码支付。
- `wechat_h5`：手机浏览器拉起微信支付。

生产环境必须配置 `WECHAT_PAY_PUBLIC_KEY`，用于回调 RSA 签名验证；代码会先验签，再用 APIv3 密钥解密 resource，并校验订单金额后才到账。

## 订单与到账

所有 provider 共用：

```text
src/lib/payments/core.ts
```

订单状态：

```text
pending -> paid
```

到账逻辑是幂等的：只有第一次 verified paid 会加积分或升级 PRO，重复回调不会重复到账。

## 商品包

```text
50积分：¥2
200积分：¥7
500积分：¥18
PRO月付：¥75/月，2500积分/月
```
