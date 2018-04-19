(module
 (type $main (func (result i32)))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (set_local $0
   (i32.const 1)
  )
  (set_local $1
   (i32.const 2)
  )
  (set_local $0
   (i32.add
    (get_local $0)
    (f32.const 1)
   )
  )
 )
)
