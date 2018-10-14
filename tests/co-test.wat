
 
;; // コルーチン定義
;; coroutine i32 Co(){
;;  i32 a = 32;
;;  yield a;
;;  while(a){
;;     a -= 1;
;;     yield a;
;;  }
;;  return a;
;; }
;; // コルーチンの初期化
;; export void initCo(){
;;    Co* co = new(0) Co();
;;  }
;; // コルーチンの実行
;; export i32 doCo(){
;;    Co* co = 0;// メモリオフセットをセット（なんという仕様。。）
;;    return co();
;;  }

;; コンパイル後のイメージ(ハンドでコンパイルしてみた) 

(module
  (type $initCo (func))
  (type $doCo (func (result i32)))
  (memory $0 1 1)
  (export "initCo" (func $initCo))
  (export "doCo" (func $doCo))
  
  ;; coroutineの初期化
  (func $initCo (type $initCo)
    ;;   Co* co = new(0) Co();
    ;; コルーチン状態管理用のメモリの初期化
    ;; 0 ... 終了
    ;; 1 ... 初期化
    ;; 2 ... 1つ目のyield
    ;; 3 ... 2つ目のyield
    (i32.store (i32.const 0) (i32.const 1))

    ;; ローカル変数 a用のメモリの初期化
    (i32.store (i32.const 4) (i32.const 0))
  )

  ;; coroutineの実行
  (func $doCo (; 0 ;) (type $doCo) (result i32)
    (block $end 
      (block $loopend
        (loop $loopstart
          (block $yield_resume
            (block $start
              (block $doCoInit
                (br_table $end $doCoInit $start $yield_resume (i32.load (i32.const 0)))
              )
              ;; 状態が1（初期化済み）の場合は先頭から実行

              ;;  i32 a = 32;
              (i32.store (i32.const 4) (i32.const 32))
  
              ;; yield a;
              ;; 1つ目のyieldの処理
              ;; yieldの次にジャンプするように状態をセット
              (i32.store (i32.const 0) (i32.const 2))
              (return (i32.load (i32.const 4)))
            )
            ;; while(a)
            (br_if $loopend (i32.eqz (i32.load (i32.const 4))))

            ;; a -= 1;
            (i32.store (i32.const 4)
              (i32.sub
                (i32.load (i32.const 4) )
                (i32.const 1)
              )
            )
            ;; yield a;
            ;; 2つ目のyieldの処理
            ;; 状態を3に設定
            (i32.store (i32.const 0) (i32.const 3))
            (return (i32.load (i32.const 4)))
          )
          ;; 状態を2に戻す
          (i32.store (i32.const 0) (i32.const 2))
          (br $loopstart)
        )
      )
      ;;状態の終了をセット
      (i32.store (i32.const 0) (i32.const 0))
    )
    ;; 値を戻す
    ;; return a;
    (i32.load (i32.const 4))
  )
)
