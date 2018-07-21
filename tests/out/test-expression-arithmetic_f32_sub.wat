(module
 (type $main (func (result f32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result f32)
  (local $0 f32)
  (local $1 f32)
  (set_local $0
   (f32.const 3)
  )
  (set_local $1
   (f32.const 2)
  )
  (return
   (f32.sub
    (get_local $0)
    (get_local $1)
   )
  )
 )
)
