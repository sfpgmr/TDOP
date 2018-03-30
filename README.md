# sgl2

glsl風の文法でwasmを出力する言語をJavaScript(node.js)で作っていきます。
ゲームを作るための言語を意図しています。

## 実装の目標

1. wasmコードをコマンドラインで生成できるようにする
2. コルーチンを言語サポートする
3. インライン・アセンブルを可能にする。もしくはwasm動的コンパイル機能をライブラリサポート、もしくは言語サポートする。

## ベースとするプロジェクト

以下のレポジトリのコードをベースまたは参考にして、作成します。

* [TDOP](https://github.com/douglascrockford/TDOP)
* [glsl-tokenizer](https://github.com/glslify/glsl-tokenizer) 
* [glsl-transpiler](https://github.com/stackgl/glsl-transpiler) 
* [glsl-parser](https://github.com/stackgl/glsl-parser)

## License

MIT, see [LICENSE.md](LICENSE.md) for further information.