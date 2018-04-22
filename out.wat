(module
 (type $mul (func (param i32 i32) (result i32)))
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $mul (; 0 ;) (type $mul) (param $0 i32) (param $1 i32) (result i32)
  (return
   (i32.mul
    (get_local $0)
    (get_local $1)
   )
  )
 )
 (func $main (; 1 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (set_local $0
   (i32.const 2)
  )
  (set_local $1
   (i32.const 2)
  )
  (set_local $1
   (i32.add
    (get_local $1)
    (i32.const 1)
   )
  )
  (if
   (i32.eq
    (get_local $0)
    (i32.const 1)
   )
   (block
    (set_local $0
     (i32.const 10)
    )
    (set_local $1
     (i32.add
      (get_local $1)
      (get_local $0)
     )
    )
   )
   (block
    (set_local $0
     (i32.const 20)
    )
    (set_local $1
     (i32.add
      (get_local $1)
      (get_local $0)
     )
    )
   )
  )
  (set_local $0
   (i32.add
    (call $mul
     (get_local $1)
     (get_local $0)
    )
    (i32.const 2)
   )
  )
  (return
   (get_local $0)
  )
 )
)
