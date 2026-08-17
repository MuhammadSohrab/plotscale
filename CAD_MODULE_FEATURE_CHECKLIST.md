# 🗺️ PlotScale CAD Measurement Module — Feature Checklist & Review Sheet

> **Nirdesh (Instructions for User):**
> - Jo features aapko **chahiye**, unke aage `[x]` lagayein.
> - Jo features **abhi nahi chahiye**, unhe `[ ]` rehne dein.
> - Har feature ke neeche **User Comments / Suggestions** me apni rai ya koi specific requirement likhein.
> - File save karke mujhe batayein taaki hum isi ke anusar implementation shuru karein.

---

## 🛠️ Category 1: CAD Drawing Edit Mode (ड्राइंग एडिट टूल्स)

### 1.1 [ ] Vertex & Grip Edit (कन्ट्रोल पॉइंट ड्रैग)
- **Feature:** CAD boundary ke kisi bhi kone (vertex) ko mouse/touch se drag karke plot ki shape aur sides modify karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 1.2 [ ] Add / Remove Corner Nodes (नोड जोड़ना / हटाना)
- **Feature:** Kisi lambi boundary line par beech me naya point (vertex) add karna ya bekar/faltu nodes ko 1-click me delete karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 1.3 [ ] Parcel Splitting / Batwara Tool (रकबा बंटवारा टूल)
- **Feature:** Ek bade Khasra plot ke beech me dividing line kheench kar use 2 ya 3 hisso me baantna (e.g. 50-50% barabar hissa ya specific area ke anusar partition).
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 1.4 [ ] Parallel Boundary & Road Offset (सड़क / चकरोड ऑफसेट)
- **Feature:** Kisi boundary line ya road ko specific doori (jaise 10ft, 20ft, 30ft) par parallel offset karke rasta ya gali create karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 1.5 [ ] Trim & Extend Tool (काटना और आगे बढ़ाना)
- **Feature:** Do aapas me cross hone wali CAD lines ko aapas me trim (cut) karna ya gap wali lines ko aage badha kar jodhna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 1.6 [ ] Rotate, Scale & Shift (घुमाना और शिफ्ट करना)
- **Feature:** Poori CAD drawing ya selected plots ko kisi point ke around rotate karna ya coordinate shift karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

---

## 📐 Category 2: Cadastral Survey & Measurement (सर्वे एवं नाप-तौल टूल्स)

### 2.1 [ ] Multi-Plot Merge & Combined Area (कुल रकबा जोड़ना)
- **Feature:** Aapas me jude huye 2 ya 2 se zyada Khasra plots ko select karke unka Total Combined Area (कुल रकबा) aur external perimeter nikalna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 2.2 [ ] Automatic Triangulation & Diagonals (त्रिकोण एवं विकर्ण कैलकुलेशन)
- **Feature:** Selected CAD plot ke andar automatically survey diagonals draw karna aur Triangle 1, Triangle 2 (T1, T2) ka alag-alag area table show karna (Sketch Pad style).
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 2.3 [ ] Perpendicular Offset / Gunia Tool (गुनिया / लम्ब नाप)
- **Feature:** Kisi main survey baseline ya road line se plot ke kisi bhi corner tak ka 90° exact perpendicular lumb distance napna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 2.4 [ ] Corner Angles Display (कोनों के कोण - Degree/Minute)
- **Feature:** Plot ke sabhi kono ke internal angles (jaise `89.5°`, `92.1°`) canvas par display karna taaki plot ke guniya/tirchhe-pan ka pata chale.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 2.5 [ ] Ground Coordinate Readout (Eastings / Northings Table)
- **Feature:** Plot ke har vertex ka exact X, Y (Northing/Easting) coordinate table generate karna jo Patwari / Surveyor Field Book me direct enter kiya ja sake.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 2.6 [ ] Automatic Khasra Text Binding (खसरा नंबर ऑटो-डिटेक्ट)
- **Feature:** CAD drawing ke andar likhe text labels (jaise 101, 102/1) ko detect karke respective boundary plots ke naam ke sath automatically link karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

---

## 🧲 Category 3: Professional CAD O-Snap Engine (ऑब्जेक्ट स्नैपिंग)

### 3.1 [ ] Endpoint Magnetic Snap (□)
- **Feature:** Line ya polyline ke aakhiri siray par cursor le jate hi exact magnetic lock lagna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 3.2 [ ] Midpoint Snap (△)
- **Feature:** Kisi bhi line segment ke theek beech (50% midpoint) par snap lock.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 3.3 [ ] Intersection Snap (✕)
- **Feature:** Jahan do lines aapas me cross karti hain, wahan exact crossing point par lock.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 3.4 [ ] Perpendicular Snap (⟂)
- **Feature:** Kisi line ke 90° right angle par magnetic snap.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

---

## 📑 Category 4: Layer & Visual Display Controls (लेयर व डिस्प्ले)

### 4.1 [ ] 1-Click Layer Isolation (सिर्फ चुनी हुई लेयर देखें)
- **Feature:** Sirf ek click se baaki saari unwanted layers ko hide karke sirf Boundary layer ko isolate karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 4.2 [ ] Thematic Color by Area (रकबे के अनुसार अलग-अलग रंग)
- **Feature:** Plot size ke anusar plots ko alag-alag color me highlight karna (e.g. 100-500 Gaj: Yellow, 500-1000 Gaj: Blue, 1 Bigha+: Green).
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 4.3 [ ] Model Space vs Layout Space Switcher (मॉडल / लेआउट स्विच)
- **Feature:** Multi-sheet AutoCAD drawings me Model Tab aur Print Layouts ke beech aasan switch button.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 4.4 [ ] X-Ray / Dim Background Mode (बैकग्राउंड डिम करें)
- **Feature:** Background non-essential CAD lines ko 25% opacity par halka karna taaki selected survey plot sabse tez chamke.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

---

## 📄 Category 5: Cadastral Export & Reports (रिपोर्ट एवं एक्सपोर्ट)

### 5.1 [ ] Official Survey PDF Naksha Sheet (सरकारी नक़्शा रिपोर्ट)
- **Feature:** North Arrow, Title Block, Owner/Khasra Details, Plot Boundary Dimensions, Diagonals Table aur Area Breakdown (Bigha, Biswa, Sq.ft, Gaj, Acre) ke sath high-res printable PDF report.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 5.2 [ ] Clean CAD DXF Export (केवल नपे हुए प्लॉट का DXF)
- **Feature:** Poori heavy drawing me se sirf measured aur finalize kiye gaye Khasra plots ko clean DXF format me download karna.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

### 5.3 [ ] Excel / CSV Survey Coordinates Export (फील्ड बुक डेटा)
- **Feature:** Sabhi plot corners ke X, Y, Side Lengths aur Triangles ka direct Excel / CSV format me download.
- **Priority:** `[ ] High (P1)   [ ] Medium (P2)   [ ] Low (P3)`
- **User Comments / Custom Notes:**
  > _(Aapka comment yahan likhein)_

---

---

## ✍️ Extra Custom Requirements / General Feedback:
> _(Yahan aap koi bhi additional requirement ya naya idea likh sakte hain jo upar list me na ho)_
> 
> 
> 
