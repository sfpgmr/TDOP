(module
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (block $for0
   (loop $loop1
    (br_if $for0
     (i32.ge_s
      (get_local $0)
      (i32.const 4)
     )
    )
    (set_local $2
     (i32.add
      (get_local $0)
      (set_local $1
       (i32.add
        (get_local $1)
        (i32.const 1)
       )
      )
     )
    )
    (set_local $0
     (i32.add
      (get_local $0)
      (i32.const 1)
     )
    )
    (br $loop1)
   )
  )
  (get_local $2)
 )
)
