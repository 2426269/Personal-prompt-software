# 达妮娅换装版 SDXL ComfyUI 提示词

日期：2026-03-28

## 设计原则

- 只做符合“星炬学院少女 + 舞台/秘密感 + 精致甜暗童话”气质的换装，不往军装、铠甲、机甲、工装方向偏
- 每套都是完整造型，不是只替换裙面花纹
- 每套都明确：服装结构、装饰重点、腿足方案、环境、动作、构图、角度、光影
- 为了避免 LoRA 强行拉回原皮，这批换装默认不写 `dnia_layered_dress`

## 共享角色锚点

```text
masterpiece, best quality, newest, absurdres, official anime illustration, highly detailed, Denia, drill sidelock, very long hair, pink hair, blue hair, dnia_hairband, dnia_hair_ribbon, delicate doll-like temperament, academy girl, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, alternate costume
```

## 共享负面词

```text
(worst quality:1.4), (low quality:1.4), normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, cropped, out of frame, bad anatomy, bad hands, bad fingers, extra fingers, missing fingers, fused fingers, extra arms, extra legs, extra limbs, malformed limbs, deformed face, asymmetrical eyes, cross-eyed, duplicate, multiple girls, mature woman, overly mature face, overly sexy, nsfw, cleavage focus, open clothes, armor, battle armor, mecha, cyberpunk suit, bodysuit, tactical gear, military uniform, worker uniform, plain dress, simple clothes, default outfit, original outfit, dnia_layered_dress, black bodysuit, bikini, bare shoulders armor, horror monster, zombie, chibi, 3d render
```

## 腿足分配总览

- 01：`jacquard tights`
- 02：`embroidered stockings`
- 03：`lace-trimmed ankle socks`
- 04：`barefoot, bare feet`
- 05：`gradient pantyhose`
- 06：`velvet stockings`

## 01 星炬冬季礼装制服

服饰重点：

- 主色：`ivory + dusty pink + deep navy`
- 结构：高领内搭、分层短斗篷、长袖束腰上衣、双层百褶裙、后腰垂带
- 装饰重点：`lace headband + pearl earrings + ribbon choker + cameo brooch + lace gloves`
- 腿足：`(jacquard tights:1.2), navy jacquard tights, matte texture, subtle woven star motifs, ribbon-trimmed mary janes`
- 适合环境：冬季学院长廊、晨雾玻璃窗、壁灯、拱门

正面词：

```text
masterpiece, best quality, newest, absurdres, official anime illustration, highly detailed, Denia, drill sidelock, very long hair, pink hair, blue hair, dnia_hairband, dnia_hair_ribbon, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing an elaborate winter academy ceremonial uniform, ivory high-neck blouse, dusty pink short capelet with fur trim, deep navy corseted waist, layered pleated skirt, trailing waist ribbons, lace headband, pearl earrings, ribbon choker, cameo brooch on chest, decorative buttons, lace gloves, fitted sleeves with cuff ornaments, (jacquard tights:1.2), navy jacquard tights, matte woven pattern, ribbon-trimmed mary janes, walking slowly through a vaulted academy corridor, hand lightly touching the wall, looking back over shoulder, medium full shot, low angle, dawn light through frosted windows, warm wall lamps and cool blue morning light, elegant scholastic atmosphere, highly layered costume design, refined collectible illustration
```

## 02 星穹观演礼裙

服饰重点：

- 主色：`rose pink + ivory + antique gold`
- 结构：束腰礼裙、前短后长外层、半透明披袖、胸前花结、裙摆多层蕾丝
- 装饰重点：`jeweled hairpiece + crystal earrings + layered necklace + jeweled clasp + lace gloves`
- 腿足：`(embroidered stockings:1.18), ivory embroidered stockings, sheer floral embroidery, ankle strap heels`
- 适合环境：小型舞台、红幕、吊星、聚光灯

正面词：

```text
masterpiece, best quality, newest, absurdres, official anime illustration, highly detailed, Denia, drill sidelock, very long hair, pink hair, blue hair, dnia_hairband, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing a luxurious academy recital gown, rose pink and ivory layered dress, fitted bodice, translucent draped sleeves, front ribbon bow, jeweled clasp, ornate layered lace skirt, asymmetrical overskirt, jeweled hairpiece, crystal drop earrings, layered necklace, decorative corsage, lace gloves, elegant waist ornament, (embroidered stockings:1.18), ivory embroidered stockings, floral embroidery, delicate ankle strap heels, standing at center stage before parted red curtains, one hand lifting the side of the skirt, the other hand near lips, full-body composition, slight low angle, spotlight from above, soft floating dust and bubbles, gold star ornaments overhead, glamorous but restrained stage charm, highly ornate costume illustration
```

## 03 午后藏书室常礼服

服饰重点：

- 主色：`cream + cocoa brown + faded blue`
- 结构：叠领衬裙、短外搭、吊带式分层长裙、胸前褶饰、后背蝴蝶结
- 装饰重点：`lace bonnet + filigree earrings + lace choker + ribbon bow + bracelet`
- 腿足：`frilled ankle socks, lace-trimmed ankle socks, soft cotton texture, strap shoes`
- 适合环境：高书架、阶梯书梯、午后光束、静室

正面词：

```text
masterpiece, best quality, newest, absurdres, official anime illustration, highly detailed, Denia, drill sidelock, very long hair, pink hair, blue hair, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing an ornate library day dress, cream layered collar blouse, cocoa brown fitted vest bodice, faded blue tiered skirt, fine pleats, lace jabot, decorative buttons, ribbon bow on chest, back bow detail, lace bonnet, filigree earrings, lace choker, bracelet, slim wrist cuffs, frilled ankle socks, lace-trimmed ankle socks, soft cotton texture, classic strap shoes, standing between tall bookshelves and a rolling ladder, fingertips brushing book spines, medium shot, eye-level composition, warm afternoon sunbeams crossing the dust in air, quiet scholarly mood, complex but gentle silhouette, refined daily wear design
```

## 04 温室晨露长裙 裸足版

服饰重点：

- 主色：`blush pink + ivory + pale teal`
- 结构：轻盈长裙、花瓣状层叠裙摆、窄腰、披帛式轻纱、后背长缎带
- 装饰重点：`floral hairpin + pearl earrings + pendant necklace + corsage + ribbon bracelet`
- 腿足：`(barefoot:1.18), bare feet, bare legs, pink toenails, delicate ankles`
- 适合环境：玻璃温室、清晨露珠、花架、浅水石砖

正面词：

```text
masterpiece, best quality, newest, absurdres, official anime illustration, highly detailed, Denia, drill sidelock, very long hair, pink hair, blue hair, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing a highly detailed conservatory morning dress, blush pink and ivory layered chiffon gown, petal-like overskirt, narrow waist ribbon, translucent trailing shawl panels, floral embroidery, floral hairpin, pearl earrings, pendant necklace, corsage at chest, ribbon bracelet, soft gathered sleeves, (barefoot:1.18), bare feet, bare legs, pink toenails, standing on shallow wet stone tiles inside a glass greenhouse, lightly lifting skirt hem with one hand, the other hand touching a dew-covered vine, full-body composition, slightly high angle, early morning diffused light through glass, pale teal reflections, romantic serene atmosphere, elegant barefoot design with complete styling
```

## 05 星象观测晚祷装

服饰重点：

- 主色：`midnight blue + silver + pale rose`
- 结构：修长上身、层叠外裙、长垂带、星纹内衬、肩部薄纱
- 装饰重点：`small tiara + gem earrings + jeweled choker + brooch + long gloves`
- 腿足：`(gradient pantyhose:1.15), semi-matte gradient pantyhose, midnight blue to pale rose gradient, pointed heels`
- 适合环境：天文塔、星图投影、月光、观测仪

正面词：

```text
masterpiece, best quality, newest, absurdres, semi-realistic anime illustration, highly detailed, cinematic shading, Denia, drill sidelock, very long hair, pink hair, blue hair, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing an elaborate observatory evening dress, midnight blue fitted bodice, silver star-pattern lining, pale rose layered overskirt, translucent shoulder drapes, trailing sash panels, small tiara, gem earrings, jeweled choker, celestial brooch, long gloves, waist chain ornament, (gradient pantyhose:1.15), semi-matte gradient pantyhose, midnight blue fading to pale rose, elegant pointed heels, standing beneath a rotating astrolabe and star projection, one leg slightly bent, hands folded near chest, three-quarter full shot, slight dutch angle, moonlight mixed with soft silver indoor glow, sacred and secretive academy ritual mood, premium high-detail costume design
```

## 06 雨夜会客裙

服饰重点：

- 主色：`wine red + black plum + ivory`
- 结构：高腰会客裙、层叠荷叶边、短披肩、垂链胸饰、后腰蝴蝶结
- 装饰重点：`mini hat + drop earrings + lace choker + jeweled clasp + wrist cuffs`
- 腿足：`(velvet stockings:1.18), wine red velvet stockings, matte plush texture, ribbon pumps`
- 适合环境：雨夜窗边、沙龙会客室、烛灯、天鹅绒窗帘

正面词：

```text
masterpiece, best quality, newest, absurdres, semi-realistic anime illustration, highly detailed, cinematic shading, Denia, drill sidelock, very long hair, pink hair, blue hair, alternate costume, academy girl, delicate doll-like temperament, soft sleepy smile, gentle but secretive expression, sweet but dangerous fairy-tale mood, wearing an ornate rainy-night salon dress, wine red high-waist dress, black plum layered ruffles, ivory inner frill, short shoulder shawl, decorative chain on bodice, jeweled clasp, back bow, mini hat with ribbon veil, drop earrings, lace choker, wrist cuffs, ring, (velvet stockings:1.18), wine red velvet stockings, matte plush texture, ribbon pumps, seated sideways on a velvet sofa near a rain-streaked window, one hand holding a teacup, the other resting beside her face, medium full shot, side view, intimate interior framing, candlelight mixed with blue rain reflections, elegant melancholic salon atmosphere, complex and luxurious feminine styling
```

## 快速控制建议

- 换装不够明显：在正面词末尾补 `different costume, redesigned outfit, not default costume`
- 服装复杂度不够：补 `highly ornate, layered details, rich trim, elaborate accessories, couture-level detail`
- 装饰区域空：补 `head accessory, earrings, choker, chest brooch, wrist accessory`
- 腿足被忽略：把对应腿足词提权，例如 `(barefoot:1.18)`, `(jacquard tights:1.2)`, `(embroidered stockings:1.18)`
- 画面太武斗：删 `dramatic`，补 `elegant, refined, gentle, feminine`
- 被拉回原皮：负面里保留 `default outfit, original outfit, dnia_layered_dress`，同时减少 `dnia_*` 服装相关词

## 首跑建议

先跑 `01 / 04 / 05`。

- `01` 用来测“学院礼装”方向是否稳
- `04` 用来测裸足和轻盈长裙能否成立
- `05` 用来测半写实下的高级复杂度是否还能保住角色感
