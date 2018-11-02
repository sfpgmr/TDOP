(module
  (export "i32tof32" (func $i32tof32))
  (export "i64tof64" (func $i64tof64))
  (export "i64Neg" (func $i64Neg))
  (memory $memory 1)
  (export "memory" (memory $memory))
  
  ;; IEE754 float32のビットパターンを持つ32ビット整数値をf32に変換する
  (func $i32tof32 (param $i i32) (param $minus i32) (result f32)
    (f32.reinterpret/i32
      (i32.xor
          (get_local $i)
          (get_local $minus)
      )
    )
  )

  ;; IEEE754 float64のビットパターンを持つ2つの32ビット値（high,low）を元にして、64bit floatを返す
  (func $i64tof64 (param $low i32) (param $high i32) (param $minus i32) (result f64)
    (f64.reinterpret/i64
      (i64.xor
        (i64.or
          (i64.shl 
            (i64.extend_u/i32 (get_local $high))
            (i64.const 32) 
          )
          (i64.extend_u/i32 (get_local $low))
        )
        (i64.shl
          (i64.extend_u/i32 (get_local $minus))
          (i64.const 32)
        )
      )
    )
  )

  ;; 整数値の2の補数をとる
  (func $i64Neg (param $low i32) (param $high i32)
    (i64.store
      (i32.const 0)
      (i64.add
        (i64.xor
          (i64.or 
            (i64.extend_u/i32 (get_local $low))
            (i64.shl 
              (i64.extend_u/i32 (get_local $high))
              (i64.const 32) 
            )
          )
          (i64.const 0xffffffffffffffff)
        )
        (i64.const 1)
      )
    )
  )
  ;; 整数値の2の補数をとる
  (func $i64Extend (param $i32value i32) 
    (i64.store
      (i32.const 0)
      (i64.extend_s/i32 (get_local $i32value))
    )
  )
)
