// 画面の文言（日本語・英語）。通常のスクリプト。globalThis.TokenMessages に置く
// ui.* は index.html の静的な文言（data-i18n）。ほかは script.js が組み立てる文言。{name} は値で埋める
(function (root) {
  'use strict';

  const JA = {
    // ===== 静的な文言 =====
    'ui.subtitle': 'トークン・APIキー・鍵のランダムな部分が何ビットあり、総当たりでどれだけかかるかを、作り方の前提とあわせて見積もるツール',
    'ui.introHeading': 'このツールについて',
    'ui.intro1': '貼り付けた文字列から、文字の種類と長さ、形式（UUID・JWT・GitHubのトークンなど）を読み取り、ランダムな部分が何ビットあるか、'
      + '総当たりで当たるまでにどれだけかかるかを見積もります。',
    'ui.intro2': 'ランダムかどうかは、文字列そのものではなく作り方で決まります。ここで出すビット数は「一様な乱数で作ったとしたら」の上限です。'
      + '人が考えたパスワードや、同じ文字の繰り返しは、この値よりずっと弱くなります。',
    'ui.intro3': '入力はブラウザーの中だけで扱い、どこにも送りません。',
    'ui.inputHeading': '入力',
    'ui.tokenLabel': 'トークン',
    'ui.samples': 'サンプル',
    'ui.sampleUuid4': 'UUID v4',
    'ui.sampleUuid7': 'UUID v7',
    'ui.sampleHex32': 'Hex(32)',
    'ui.sampleBase64': 'Base64',
    'ui.sampleAlnum16': '英数16',
    'ui.sampleAlnum32': '英数32',
    'ui.sampleJwt': 'JWT',
    'ui.sampleGithub': 'GitHub形式',
    'ui.sampleSame': '同じ文字',
    'ui.samplePassword': 'Password1!',
    'ui.tokenPlaceholder': '例）3f1a0b2c… ／919108f7-52d1-4320-9bac-f847db4148a8',
    'ui.clear': 'クリア',
    'ui.optionsHeading': '前提を変える',
    'ui.charsetLabel': '文字の集合',
    'ui.csAuto': '自動（見た文字から選ぶ）',
    'ui.csDigits': '数字（10種）',
    'ui.csHex': '16進数（16種）',
    'ui.csBase32': 'Base32（32種）',
    'ui.csBase62': '英数字（62種）',
    'ui.csBase64': 'Base64・base64url（64種）',
    'ui.csPrintable': 'ASCIIの印字できる文字（95種）',
    'ui.csCustom': '数を指定する',
    'ui.customSizeLabel': '文字の数（2以上の整数）',
    'ui.standardLabel': '判定の基準',
    'ui.stSession': 'セッションID：64ビット（OWASP・NIST SP 800-63B-4）',
    'ui.stNist112': '長く使う鍵：112ビット（NIST SP 800-57、2030年まで）',
    'ui.stNist128': '長く使う鍵：128ビット（NIST SP 800-57、2031年から）',
    'ui.stOtp': 'ワンタイムパスワードの鍵：160ビット（RFC 4226の推奨）',
    'ui.stHs256': 'JWTのHS256の鍵：256ビット（RFC 7518）',
    'ui.stCustom': 'ビット数を指定する',
    'ui.customBitsLabel': '基準のビット数（1〜1024）',
    'ui.validLabel': '有効な値の数（同時に使われているトークンの数）',
    'ui.gpusLabel': 'GPUの枚数（ハッシュが漏れた場面に掛ける）',
    'ui.customRateLabel': '自由な速さ（回/秒。空欄なら使わない）',
    'ui.resultHeading': '結果',
    'ui.bitsLabel': 'ランダムな部分',
    'ui.formatLabel': '形式',
    'ui.charsetResultLabel': '文字の集合',
    'ui.countedLabel': '数えた文字',
    'ui.perCharLabel': '1文字あたり',
    'ui.shannonLabel': '1文字あたりのばらつき（シャノン）',
    'ui.gaugeLabel': 'ビット数と基準（0〜256ビット）',
    'ui.notesHeading': '気づいたこと',
    'ui.timeHeading': '総当たりで当たるまでの時間',
    'ui.colScenario': '場面',
    'ui.colRate': '速さ',
    'ui.colAvg': '平均',
    'ui.colWorst': '最悪（全部試す）',
    'ui.timeNote': '候補がN通り、有効な値がK個あるとき、重複なしで1つずつ試して最初に当たるまでの回数は平均 (N+1)÷(K+1)、最悪N−K+1です。'
      + 'ハッシュが漏れた場面の速さは、hashcat 6.2.6のRTX 5090 1枚の公開ベンチマークの値です。',
    'ui.scannersHeading': 'シークレット検出ツールから見えるか',
    'ui.colTool': 'ツール・ルール',
    'ui.colLimit': 'しきい値',
    'ui.colValue': 'この文字列',
    'ui.colHit': '見つかるか',
    'ui.scannersNote': '1文字あたりのシャノンエントロピー（文字の出現率から出す値）がしきい値を超えると、シークレットとして見つかります。'
      + '長さnの文字列ではlog₂(n) が上限なので、短い文字列は本物の乱数でも見つかりません。',
    'ui.howHeading': '見積もりの仕組み',
    'ui.howCharsetTitle': '文字の集合',
    'ui.howCharset': '見た文字をすべて含む、いちばん小さい標準の集合（数字・16進数・Base32・英数字・Base64など）を選び、1文字あたりlog₂(文字の数) ビットとします。'
      + '作り方がわかっているときは「前提を変える」で指定します。',
    'ui.howBitsTitle': 'ビット数',
    'ui.howBits': 'ビット数 ＝ 数えた文字数 × log₂(文字の数)。UUID・JWT・GitHubのトークンは、形式の決まりからランダムな部分だけを数えます。',
    'ui.howTimeTitle': '時間',
    'ui.howTime': '候補は「2のビット数乗」通りあり、それを場面ごとの速さで試すとして、当たるまでの時間を出します。有効な値が多いほど、どれか1つには早く当たります。',
    'ui.howLimitTitle': '限界',
    'ui.howLimit': '1本の文字列からは、ランダムに作ったかどうかは分かりません。分かるのは上限と、明らかな構造（同じ文字の繰り返し・並び・中身が読める）だけです。',
    'ui.footerRepo': 'GitHubリポジトリー',
    'ui.themeToDark': 'ダークモードにする',
    'ui.themeToLight': 'ライトモードにする',
    'ui.helpClose': '閉じる',
    'ui.helpCharsetLabel': '文字の集合の説明',
    'ui.helpStandardLabel': '判定の基準の説明',
    'ui.helpValidLabel': '有効な値の数の説明',
    'ui.helpTimeLabel': '攻撃の場面の説明',
    'ui.helpScannersLabel': 'シークレット検出の説明',
    'ui.helpShannonLabel': 'シャノンエントロピーの説明',
    'ui.helpCharset1': '見た文字をすべて含む、いちばん小さい標準の集合を選びます（数字10・16進数16・Base32は32・英数字62・Base64とbase64urlは64、'
      + 'それ以外は小文字26・大文字26・数字10・記号32・空白1を足す）。',
    'ui.helpCharset2': '実際の作り方の集合より小さく見えることがあります（英数字のトークンにたまたま数字がない、など）。'
      + '作り方がわかっているときは、ここで指定すると、その集合で数えます（形式の判定は使いません）。',
    'ui.helpStandard1': 'セッションID：64ビット（OWASP Session Management Cheat Sheet、NIST SP 800-63B-4のセッションの秘密）。',
    'ui.helpStandard2': '長く使う鍵：NIST SP 800-57 Part 1 Rev.5の表4で、安全性の強さ112ビットは2030年まで、2031年からは128ビット以上。'
      + 'APIキーやトークンのランダムな部分も、この強さを目安にします。',
    'ui.helpStandard3': 'ワンタイムパスワード（HOTP・TOTP）の共有鍵：RFC 4226は128ビット以上を必須、160ビットを推奨としています。',
    'ui.helpStandard4': 'JWTのHS256の鍵：RFC 7518の3.2は、ハッシュの出力と同じ256ビット以上の鍵を求めています。',
    'ui.helpValid1': '同時に使われているトークンが多いほど、攻撃者はどれか1つに当てればよいので早く当たります。候補がN通り、有効な値がK個なら、'
      + '重複なしで試して最初に当たるまでの回数は平均 (N+1)÷(K+1) です。',
    'ui.helpValid2': 'OWASPの例：64ビットのセッションIDが10万個使われていて、1秒に1万回試せるなら、当たるまで約585年です（有効な値の数に100000、'
      + '場面は「オンライン（制限なし）」）。',
    'ui.helpTime1': 'オンライン（試行に制限あり）：1時間に100回（zxcvbnの想定）。オンライン（制限なし）：1秒に1万回（OWASPの例）。',
    'ui.helpTime2': 'ハッシュが漏れた場面：トークンのハッシュ値が漏れて、手元で総当たりする場合。hashcat 6.2.6のRTX 5090 1枚の公開ベンチマークで、'
      + 'bcrypt（ベンチマーク既定のコスト5）30.48万回/秒、SHA-256は283.5億回/秒、MD5は2206億回/秒。GPUの枚数を掛けます。',
    'ui.helpTime3': 'トークンを平文のまま保存していて、それが漏れたら、ビット数に関係なくそのまま使われます。',
    'ui.helpScanners1': 'detect-secrets（Yelp）は、Base64の文字だけの文字列は1文字あたり4.5、16進数の文字だけの文字列は3.0を超えると見つけます'
      + '（数字だけの16進数は 1.2÷log₂(長さ) を引きます）。',
    'ui.helpScanners2': 'gitleaksの汎用APIキーのルールは3.5を超えると見つけます。ただし、key・tokenなどの言葉の近くにある文字列だけが対象です。',
    'ui.helpScanners3': '長さnの文字列では1文字あたり log₂(n) が上限なので、22字以下（log₂22≈4.46）は、本物の乱数でもBase64側の4.5を超えません。',
    'ui.helpShannon1': '文字列の中の文字の出現率から出す値（−Σ p log₂ p）です。作り方のエントロピーではありません。',
    'ui.helpShannon2': '長さnでは log₂(n) を超えないので、短い文字列では、ランダムでも小さく出ます。同じ文字ばかりだと0に近づきます。',
    'ui.noscript': 'このツールはJavaScriptで動きます。JavaScriptを有効にしてください。',

    // ===== 結果の文 =====
    'verdict.none': 'トークンを入れると結果を表示します',
    'verdict.meets': '基準（{std}ビット）以上です',
    'verdict.below': '基準（{std}ビット）に届いていません',
    'verdict.pattern': '構造があるため判定しません（「気づいたこと」を参照）',
    'verdict.notApplicable': 'エントロピーで強さを測る文字列ではありません',
    'verdict.unknown': '文字の集合が決められません（「前提を変える」で指定できます）',
    'verdict.noThreshold': '基準のビット数を正しく入れると判定します',
    'bits.value': '{bits}ビット',
    'bits.uniform': '一様な乱数で作ったときの上限',
    'bits.spec': '形式の決まりから数えた値',
    'bits.none': '—',
    'counted.value': '{counted}字（全体{length}字）',
    'perChar.value': '{bits}ビット',
    'shannon.value': '{v}ビット（この長さで出せる上限{max}）',
    'format.uuid': 'UUID（バージョン{v}）',
    'format.uuidNil': 'UUID（すべて0の特別な値）',
    'format.uuidMax': 'UUID（すべて1の特別な値）',
    'format.uuidOther': 'UUIDの形（RFC 9562の変種ではない）',
    'format.jwt': 'JWT（署名つきトークン、alg: {alg}）',
    'format.github': 'GitHubのトークン（{prefix}_）',
    'format.digits': '数字',
    'format.hex': '16進数',
    'format.base32': 'Base32',
    'format.base64': 'Base64',
    'format.base64url': 'base64url',
    'format.classes': '文字の種類の組み合わせ',
    'format.nonAscii': 'ASCII以外の文字を含む',
    'format.specified': '文字の集合を指定',
    'cs.digits': '数字（10）',
    'cs.hex': '16進数（16）',
    'cs.base32': 'Base32（32）',
    'cs.base62': '英数字（62）',
    'cs.base64': 'Base64（64）',
    'cs.base64url': 'base64url（64）',
    'cs.printable': 'ASCIIの印字できる文字（95）',
    'cs.custom': '指定した数（{n}）',
    'cs.classes': '{list}（{n}）',
    'cs.join': '＋',
    'cls.lower': '小文字',
    'cls.upper': '大文字',
    'cls.digits': '数字',
    'cls.symbols': '記号',
    'cls.space': '空白',

    // ===== 形式の説明 =====
    'fmt.uuid4': 'ランダムな部分は122ビットです（128ビットのうち、版と変種の6ビットは固定）。',
    'fmt.uuid7': '先頭48ビットはミリ秒の時刻で、ランダムな部分は74ビットです。作った時刻が読めて、続けて作ると前半がそろいます。',
    'fmt.uuidTime': '時刻と機器の番号から作る版で、ランダムな部分はほとんどありません。秘密の値には使えません。',
    'fmt.uuidName': '名前のハッシュから作る版で、同じ名前からは同じ値になります。秘密の値ではありません。',
    'fmt.uuid8': '中身を実装が決める版で、ランダムな部分の量は決まっていません。',
    'fmt.uuidOtherVersion': 'RFC 9562で中身を定めていない版です。',
    'fmt.uuidSpecial': '決まった特別な値で、ランダムな部分はありません。',
    'fmt.uuidOther': '変種のビットがRFC 9562の形ではないので、中身は読みません。',
    'fmt.jwt': 'JWTは、ヘッダーとペイロードをbase64urlで書いただけで、誰でも読めます。強さを決めるのは署名の鍵です（HS256なら256ビット以上）。'
      + '中身はDay053 JWT Inspectorで確かめられます。',
    'fmt.github': 'ランダムな部分は30文字（178.6ビット）です。接頭辞と、最後の6文字のチェックサム（CRC-32）は数えません。',
    'fmt.githubOk': 'チェックサムも合っています。',

    // ===== 気づいたこと =====
    'w.truncated': '{max}字を超えた部分は解析していません。',
    'w.uuidTime': 'このUUIDには作った時刻が入っています（{time}、UTC）。時刻の部分は推測できます。',
    'w.githubChecksum': 'チェックサムが合いません。写し間違いか、本物でない文字列です。',
    'w.nonAscii': 'ASCII以外の文字（日本語・絵文字など）を含むため、文字の集合を自動では決められません。',
    'w.badCustomSize': '文字の数は2以上の整数で入れてください。',
    'w.decodedText': '中身は読める文字列です（{bytes}バイト：「{preview}」）。ランダムなバイト列ではありません。',
    'w.hashLength': '{bits}ビットのハッシュ値（{names}）と同じ長さです。ハッシュ値なら、強さは元の値で決まります（Day002 Hash Detector）。',
    'w.prefix': '先頭の「{prefix}」は決まった接頭辞かもしれません。接頭辞を除くと{bits}ビットです。',
    'w.allSame': 'すべて同じ文字です。',
    'w.repeated': '{period}文字のかたまりの繰り返しです。',
    'w.sequence': '{run}文字続く並び（abcd・9876など）があります。この長さの文字列では、偶然にはまず現れません。',
    'w.keyboard': 'キーボードの並び（{run}文字、qwertyなど）があります（Day089 Keywalk Analyzer）。',
    'w.lowVariety': '使っている文字の種類が少なく、偏りがあります。',
    'w.human': '人が考えた文字列（パスワードなど）なら、辞書や規則から先に試されるので、この見積もりよりずっと弱くなります（Day001 Password Checker）。',
    'hash.128': 'MD5など',
    'hash.160': 'SHA-1など',
    'hash.256': 'SHA-256など',
    'hash.512': 'SHA-512など',

    // ===== 時間・速さ =====
    'dur.underSecond': '1秒未満',
    'dur.seconds': '{n}秒',
    'dur.minutes': '{n}分',
    'dur.hours': '{n}時間',
    'dur.days': '{n}日',
    'dur.years': '{n}{scale}年',
    'dur.yearsExp': '{m}×10{e}年',
    'dur.universe': '宇宙の年齢の{n}{scale}倍',
    'dur.withUniverse': '{time}（{universe}）',
    'scale.man': '万',
    'scale.oku': '億',
    'scale.cho': '兆',
    'scale.kei': '京',
    'rate.perSecond': '{n}{scale}回/秒',
    'rate.perSecondExp': '{m}×10{e}回/秒',
    'rate.perHour': '{n}回/時',
    'sc.onlineThrottled': 'オンライン（試行に制限あり）',
    'sc.onlineUnthrottled': 'オンライン（制限なし）',
    'sc.offlineBcrypt': 'ハッシュが漏れた：bcrypt（コスト5）',
    'sc.offlineSha256': 'ハッシュが漏れた：SHA-256',
    'sc.offlineMd5': 'ハッシュが漏れた：MD5',
    'sc.custom': '指定した速さ',
    'sc.gpus': '（GPU {n}枚）',

    // ===== シークレット検出 =====
    'scan.detectSecretsBase64': 'detect-secrets（Base64の文字）',
    'scan.detectSecretsHex': 'detect-secrets（16進数の文字）',
    'scan.gitleaks': 'gitleaks（汎用APIキーのルール）',
    'scan.hit': '見つかる',
    'scan.miss': '見つからない',
    'scan.na': '対象外（使えない文字がある）',
    'scan.gitleaksNote': 'gitleaksは、key・tokenなどの言葉の近くにある文字列にだけ、このしきい値を使います。',

    // ===== 入力の誤り =====
    'err.customBits': '1〜1024の整数で入れてください。',
    'err.valid': '1以上の整数で入れてください（上限1京）。',
    'err.gpus': '1〜100万の整数で入れてください。',
    'err.customRate': '0より大きい数で入れてください（例: 1e9）。'
  };

  const EN = {};

  const MESSAGES = { ja: JA, en: EN };
  let current = 'ja';

  function setLanguage(lang) {
    current = lang === 'en' ? 'en' : 'ja';
  }

  function getLanguage() {
    return current;
  }

  // キーの文言を、{name} を値で埋めて返す。英語にないキーは日本語、どちらにもなければキーのまま
  function t(key, vars = {}, lang = current) {
    const dict = MESSAGES[lang] || JA;
    const s = key in dict ? dict[key] : key in JA ? JA[key] : key;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  root.TokenMessages = { MESSAGES, setLanguage, getLanguage, t };
})(typeof globalThis !== 'undefined' ? globalThis : this);
