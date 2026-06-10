# 官方支付宝 / 微信支付接入实操手册

本项目支持三类支付 provider：

1. 官方支付宝 `alipay`
2. 官方微信支付 V3 `wechat`
3. 易支付备用通道 `ezfpy`

前端会请求：

```text
GET /api/pay/providers
```

只有对应 Vercel 环境变量配置齐全时，支付按钮才会启用。

---

## 0. 先确认你的正式域名

所有支付回调都必须使用公网 HTTPS 域名，不能用 localhost。

本文假设正式域名是：

```text
https://你的域名
```

在 Vercel 必须配置：

```env
NEXT_PUBLIC_SITE_URL=https://你的域名
NEXTAUTH_URL=https://你的域名
```

如果项目现在部署在：

```text
https://ecom-ai-five.vercel.app
```

那就先填：

```env
NEXT_PUBLIC_SITE_URL=https://ecom-ai-five.vercel.app
NEXTAUTH_URL=https://ecom-ai-five.vercel.app
```

后续绑定自定义域名后，再改成正式域名。

---

# 1. 支付宝官方支付

## 1.1 需要准备什么

支付宝官方支付需要这些值：

```env
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_KEY_TYPE=PKCS8
```

对应关系：

| 环境变量 | 去哪里拿 | 是什么 |
|---|---|---|
| `ALIPAY_APP_ID` | 支付宝开放平台应用详情页 | 应用 ID |
| `ALIPAY_PRIVATE_KEY` | 你自己用支付宝密钥工具生成 | 应用私钥，自己保存，支付宝平台不会给你看 |
| `ALIPAY_PUBLIC_KEY` | 支付宝开放平台密钥页面 | 支付宝公钥，不是应用公钥 |
| `ALIPAY_GATEWAY` | 固定值 | 正式环境网关 |
| `ALIPAY_KEY_TYPE` | 固定值 | 建议用 `PKCS8` |

---

## 1.2 去哪里创建支付宝应用

打开：

```text
https://open.alipay.com/
```

登录后进入：

```text
控制台 / 开发者中心
```

然后：

```text
网页 & 移动应用
↓
创建应用
```

应用类型通常选：

```text
网页应用 / 网站应用
```

应用创建后，进入应用详情页，可以看到：

```text
APPID / 应用ID
```

这个填到：

```env
ALIPAY_APP_ID=你的应用ID
```

---

## 1.3 开通哪个支付宝能力

在支付宝应用里添加能力，优先开：

```text
电脑网站支付
```

如果还要手机浏览器支付，再开：

```text
手机网站支付
```

当前代码第一版用的是：

```text
alipay.trade.page.pay
```

也就是电脑网站支付。它在手机浏览器也能跳支付宝，但最标准的是先开电脑网站支付。

---

## 1.4 怎么生成支付宝密钥

支付宝官方有一个工具：

```text
支付宝开放平台密钥工具
```

下载入口通常在开放平台文档里，搜索：

```text
支付宝开放平台密钥工具 RSA2
```

或者在应用的：

```text
开发设置 / 接口加签方式 / 设置
```

页面里会提示下载。

打开密钥工具后：

```text
密钥长度：RSA2
密钥格式：PKCS8
```

生成后你会得到两段：

```text
应用私钥
应用公钥
```

它们的用途不同：

```text
应用私钥：填到 Vercel 的 ALIPAY_PRIVATE_KEY
应用公钥：上传到支付宝开放平台
```

注意：应用私钥只在你本地工具里生成，支付宝后台不会保存给你下载，所以要自己安全保存。

---

## 1.5 支付宝公钥在哪里拿

你上传“应用公钥”之后，支付宝会生成/展示：

```text
支付宝公钥
```

这个才填到：

```env
ALIPAY_PUBLIC_KEY=
```

不要填错：

```text
ALIPAY_PRIVATE_KEY = 应用私钥
ALIPAY_PUBLIC_KEY  = 支付宝公钥
应用公钥             = 上传给支付宝，不填进 Vercel
```

---

## 1.6 支付宝回调地址怎么填

支付宝开放平台应用里找到：

```text
开发设置
↓
授权回调地址 / 接口加签 / 支付能力相关配置
```

如果有异步通知地址，填：

```text
https://你的域名/api/pay/alipay/notify
```

如果有页面跳转返回地址，填：

```text
https://你的域名/pay/result
```

本项目代码里创建订单时也会传：

```text
notify_url = https://你的域名/api/pay/alipay/notify
return_url = https://你的域名/pay/result?out_trade_no=订单号
```

所以最关键的是 `NEXT_PUBLIC_SITE_URL` 必须正确。

---

## 1.7 Vercel 支付宝环境变量怎么写

Vercel 项目里进入：

```text
Settings
↓
Environment Variables
```

添加：

```env
ALIPAY_APP_ID=你的支付宝应用ID
ALIPAY_PRIVATE_KEY="把应用私钥按 Vercel 格式粘贴到这里，换行用 \\n 表示"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n这里是支付宝公钥内容\n-----END PUBLIC KEY-----"
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_KEY_TYPE=PKCS8
NEXT_PUBLIC_SITE_URL=https://你的域名
NEXTAUTH_URL=https://你的域名
```

如果 Vercel 多行粘贴不方便，可以用 `\n` 表示换行。代码会自动把 `\n` 转回真实换行。

---

## 1.8 支付宝沙箱怎么配

如果先用沙箱测试：

```env
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

沙箱的：

```text
APP_ID
应用私钥
支付宝公钥
```

都要用沙箱环境对应的，不能和正式环境混用。

上线正式收款时再改回：

```env
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
```

---

# 2. 微信支付 V3

## 2.1 需要准备什么

微信支付官方需要这些值：

```env
WECHAT_PAY_APPID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_CERT_SERIAL=
WECHAT_PAY_PUBLIC_KEY_ID=
WECHAT_PAY_PUBLIC_KEY=
```

对应关系：

| 环境变量 | 去哪里拿 | 是什么 |
|---|---|---|
| `WECHAT_PAY_APPID` | 微信支付商户平台 / 产品中心 / AppID 账号管理 | 绑定到商户号的公众号/小程序/移动应用 AppID |
| `WECHAT_PAY_MCH_ID` | 微信支付商户平台首页 | 商户号 |
| `WECHAT_PAY_API_V3_KEY` | 微信支付商户平台 / API 安全 | 你自己设置的 32 位 APIv3 密钥 |
| `WECHAT_PAY_PRIVATE_KEY` | API 证书下载包里的私钥文件 | 商户 API 私钥 |
| `WECHAT_PAY_CERT_SERIAL` | API 证书页面或证书查看命令 | 商户 API 证书序列号 |
| `WECHAT_PAY_PUBLIC_KEY_ID` | 微信支付公钥管理页面 | 微信支付公钥 ID |
| `WECHAT_PAY_PUBLIC_KEY` | 微信支付公钥管理页面下载/复制 | 微信支付平台公钥 |

---

## 2.2 去哪里开通微信支付

打开：

```text
https://pay.weixin.qq.com/
```

登录微信支付商户平台。

如果还没有商户号，需要先申请：

```text
接入微信支付
↓
注册商户号
↓
提交营业执照/法人/结算账户等资料
↓
审核通过
```

审核通过后，在商户平台首页能看到：

```text
商户号 mchid
```

填到：

```env
WECHAT_PAY_MCH_ID=你的商户号
```

---

## 2.3 WECHAT_PAY_APPID 去哪里拿

微信支付必须绑定一个 AppID。

在微信支付商户平台进入：

```text
产品中心
↓
AppID 账号管理
```

绑定你的：

```text
公众号 AppID
小程序 AppID
移动应用 AppID
```

本项目做网页支付，通常用：

```text
公众号 AppID
```

绑定后，把这个 AppID 填到：

```env
WECHAT_PAY_APPID=你的AppID
```

注意：这不是商户号，也不是 APIv3 密钥。

---

## 2.4 APIv3 密钥怎么设置

进入微信支付商户平台：

```text
账户中心
↓
API 安全
↓
设置 APIv3 密钥
```

APIv3 密钥要求：

```text
32 个字符
```

你自己生成一串强随机字符串，保存下来，填到：

```env
WECHAT_PAY_API_V3_KEY=你的32位APIv3密钥
```

这个值微信平台不会明文展示给你看，忘了只能重置。

---

## 2.5 商户 API 证书和私钥怎么拿

进入：

```text
账户中心
↓
API 安全
↓
API 证书
```

按微信支付提示下载/申请 API 证书。

通常会得到类似文件：

```text
apiclient_cert.pem
apiclient_key.pem
apiclient_cert.p12
```

本项目需要的是：

```text
apiclient_key.pem
```

把整个私钥内容填到：

```env
WECHAT_PAY_PRIVATE_KEY="把 apiclient_key.pem 私钥内容按 Vercel 格式粘贴到这里，换行用 \\n 表示"
```

不要填 `apiclient_cert.pem`，也不要填 `.p12`。

---

## 2.6 商户 API 证书序列号怎么拿

方法一：商户平台页面查看。

在：

```text
账户中心
↓
API 安全
↓
API 证书
```

通常可以看到证书序列号，填到：

```env
WECHAT_PAY_CERT_SERIAL=证书序列号
```

方法二：本地命令查看。

如果你有 `apiclient_cert.pem`，可以运行：

```bash
openssl x509 -in apiclient_cert.pem -noout -serial
```

输出类似：

```text
serial=1234567890ABCDEF1234567890ABCDEF12345678
```

把 `serial=` 后面的值填到：

```env
WECHAT_PAY_CERT_SERIAL=1234567890ABCDEF1234567890ABCDEF12345678
```

---

## 2.7 微信支付公钥从哪里拿

微信支付 V3 回调需要验证微信侧签名。

进入商户平台：

```text
账户中心
↓
API 安全
↓
微信支付公钥 / 平台证书 / 平台公钥
```

不同商户后台版本名字可能略有不同。你要拿到两样东西：

```text
微信支付公钥 ID
微信支付公钥内容
```

分别填：

```env
WECHAT_PAY_PUBLIC_KEY_ID=微信支付公钥ID
WECHAT_PAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n微信支付公钥内容\n-----END PUBLIC KEY-----"
```

当前代码强制要求 `WECHAT_PAY_PUBLIC_KEY`，没有它微信支付按钮不会启用。

---

## 2.8 微信支付回调地址怎么填

在微信支付商户平台产品配置里，按支付产品填写通知地址。

本项目微信支付通知地址：

```text
https://你的域名/api/pay/wechat/notify
```

当前支持：

```text
Native 支付：电脑端展示二维码，用户微信扫码
H5 支付：手机浏览器拉起微信支付
```

如果你只先做电脑端扫码，优先开：

```text
Native 支付
```

---

## 2.9 Vercel 微信支付环境变量怎么写

Vercel 项目：

```text
Settings
↓
Environment Variables
```

添加：

```env
WECHAT_PAY_APPID=你的微信AppID
WECHAT_PAY_MCH_ID=你的商户号
WECHAT_PAY_API_V3_KEY=你的32位APIv3密钥
WECHAT_PAY_PRIVATE_KEY="把 apiclient_key.pem 私钥内容按 Vercel 格式粘贴到这里，换行用 \\n 表示"
WECHAT_PAY_CERT_SERIAL=你的商户API证书序列号
WECHAT_PAY_PUBLIC_KEY_ID=微信支付公钥ID
WECHAT_PAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n这里是微信支付公钥内容\n-----END PUBLIC KEY-----"
NEXT_PUBLIC_SITE_URL=https://你的域名
NEXTAUTH_URL=https://你的域名
```

同样，如果 Vercel 不方便粘多行 PEM，就用 `\n` 表示换行。

---

# 3. Vercel 配完以后要做什么

每次新增或修改 Vercel 环境变量后，都需要：

```text
重新部署 Redeploy
```

否则线上函数读不到新环境变量。

建议步骤：

```text
Vercel Project
↓
Settings
↓
Environment Variables
↓
添加变量
↓
Deployments
↓
选择最新部署
↓
Redeploy
```

---

# 4. 怎么判断配置生效

登录网站后打开购买弹窗。

如果支付宝配置完整：

```text
支付宝官方 ✅
```

如果微信配置完整：

```text
微信扫码 ✅
微信 H5 ✅
```

如果显示：

```text
未配置
```

说明 Vercel 环境变量缺失或部署还没刷新。

也可以直接访问接口：

```text
https://你的域名/api/pay/providers
```

返回类似：

```json
{
  "providers": {
    "alipay": true,
    "wechat": false,
    "ezfpy": false
  }
}
```

---

# 5. 真实小额测试流程

建议先测试最低金额：

```text
50积分包：¥2
```

流程：

```text
1. 登录网站
2. 点购买积分 / PRO
3. 选择支付宝官方或微信扫码
4. 买 50 积分包
5. 完成支付
6. 回到 /pay/result
7. 点刷新状态
8. 确认订单状态变成 paid
9. 回工作台确认总积分增加 50
```

如果付款成功但没到账，优先查：

```text
1. 支付平台回调地址是否是 https://你的域名/api/pay/.../notify
2. NEXT_PUBLIC_SITE_URL 是否是正式域名
3. Vercel 是否 redeploy 过
4. 支付平台后台是否显示异步通知失败
5. Vercel Function Logs 里 notify 接口错误
```

---

# 6. 常见错误排查

## 6.1 支付宝按钮还是未配置

检查：

```text
ALIPAY_APP_ID
ALIPAY_PRIVATE_KEY
ALIPAY_PUBLIC_KEY
```

这三个必须都有。

`ALIPAY_PRIVATE_KEY` 是应用私钥。

`ALIPAY_PUBLIC_KEY` 是支付宝公钥。

不要把“应用公钥”填到 `ALIPAY_PUBLIC_KEY`。

---

## 6.2 支付宝验签失败

通常是：

```text
ALIPAY_PUBLIC_KEY 填错
沙箱和正式密钥混用
私钥格式不是 PKCS8，但 ALIPAY_KEY_TYPE 写了 PKCS8
复制 PEM 时丢了换行
```

如果私钥头部显示 `BEGIN RSA PRIVATE KEY`，通常是 PKCS1，需要：

```env
ALIPAY_KEY_TYPE=PKCS1
```

如果私钥头部显示 `BEGIN PRIVATE KEY`，通常是 PKCS8，需要：

```env
ALIPAY_KEY_TYPE=PKCS8
```

---

## 6.3 微信按钮还是未配置

检查这些必须都有：

```text
WECHAT_PAY_APPID
WECHAT_PAY_MCH_ID
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_PRIVATE_KEY
WECHAT_PAY_CERT_SERIAL
WECHAT_PAY_PUBLIC_KEY
```

缺任意一个，微信按钮都会显示未配置。

---

## 6.4 微信创建订单失败

常见原因：

```text
商户号和 AppID 没有关联
Native/H5 支付产品没开通
商户私钥填错，签名失败
商户证书序列号填错
APIv3 密钥不是 32 位
H5 支付没有配置支付域名
```

---

## 6.5 微信回调失败

常见原因：

```text
WECHAT_PAY_PUBLIC_KEY 不是微信支付公钥
APIv3 密钥错误，resource 解密失败
回调地址不是公网 HTTPS
Vercel 环境变量改了但没 redeploy
订单金额不一致，系统拒绝到账
```

---

# 7. 安全注意事项

不要把这些内容发到聊天、写进仓库或截图公开：

```text
ALIPAY_PRIVATE_KEY
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_PRIVATE_KEY
GitHub Token
SMTP 授权码
```

可以给小哈看的通常是：

```text
APP_ID
商户号
回调地址
报错文本
```

私钥和密钥建议只放 Vercel Environment Variables。

---

# 8. 当前商品包

```text
50积分：¥2
200积分：¥7
500积分：¥18
PRO月付：¥75/月，2500积分/月
```

所有价格和到账权益以后都应从服务端商品表修改：

```text
src/lib/payments/core.ts
```

前端只传 `packId`，不会信任前端传来的金额。
