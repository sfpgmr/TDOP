(module
 (type $𩸽 (func (param i32 i32) (result i32)))
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $𩸽 (; 0 ;) (type $𩸽) (param $0 i32) (param $1 i32) (result i32)
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
   (i32.const 1)
  )
  (set_local $1
   (i32.const 1)
  )
  (if
   (i32.ne
    (get_local $0)
    (i32.const 2)
   )
   (block
    (set_local $0
     (i32.const 2)
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
     (i32.const 3)
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
   (call $𩸽
    (get_local $1)
    (get_local $0)
   )
  )
  (set_local $1
   (i32.sub
    (get_local $1)
    (i32.const 1)
   )
  )
  (set_local $0
   (i32.add
    (get_local $0)
    (get_local $1)
   )
  )
  (set_local $1
   (i32.sub
    (get_local $1)
    (i32.const 1)
   )
  )
  (return
   (get_local $0)
  )
  (set_local $1
   (i32.sub
    (get_local $1)
    (i32.const 1)
   )
  )
 )
)
