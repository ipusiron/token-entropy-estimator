// サンプル（通常のスクリプト。globalThis.TokenSamples に置く）
// UUID は RFC 9562 の付録の例、JWT は RFC 7519 3.1 の例
// GitHub 形式は、本物と同じ形の文字列をソースに書かない（シークレット検出の誤検知を避ける）ため、実行時に組み立てる
(function (root) {
  'use strict';
  root.TokenSamples = {
    uuid4: '919108f7-52d1-4320-9bac-f847db4148a8',
    uuid7: '017F22E2-79B0-7CC3-98C4-DC0C0C07398F',
    hex32: '3f1a0b2c9d7e4a1f0c5b6d8e2a7c9b1d',
    base64: 'QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
    alnum16: 'A7kLw39mQp8Zr2Tx',
    alnum32: 'G5hQmT9Zs1BcK8rV2xY4nP7uD3jL6wEa',
    jwt: 'eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ'
      + '.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    github: ['gh', 'p_', 'A7kLw39mQp8Zr2TxG5hQmT9Zs1BcK8', '2FyxDi'].join(''),
    same: 'aaaaaaaaaaaaaaaa',
    password: 'Password1!'
  };
  root.TokenSampleOrder = ['uuid4', 'uuid7', 'hex32', 'base64', 'alnum16', 'alnum32', 'jwt', 'github', 'same', 'password'];
})(typeof globalThis !== 'undefined' ? globalThis : this);
