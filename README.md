# sgl2

glslのようなベクトルと行列演算が可能なオレオレ言語をJavaScript(node.js)で作っていきます。
ゲームを作るための言語を意図しています。

## 実装の目標

1. wasmバイナリをコマンドラインで生成できるようにする
2. コルーチンを言語サポートする
3. glslのベクトル・行列演算機能をサポートする
3. インライン・アセンブルを可能にする

## 参考プロジェクト

以下のレポジトリのコードをベースまたは参考にして、作成します。

* [TDOP](https://github.com/douglascrockford/TDOP)
* [binaryen.js](https://github.com/AssemblyScript/binaryen.js/)
* [glsl-tokenizer](https://github.com/glslify/glsl-tokenizer) 
* [glsl-transpiler](https://github.com/stackgl/glsl-transpiler) 
* [glsl-parser](https://github.com/stackgl/glsl-parser)

## 成果物

* [https://github.sfpgmr.net/sgl2/](https://github.sfpgmr.net/sgl2/)

## License

MIT, see [LICENSE.md](LICENSE.md) for further information. 