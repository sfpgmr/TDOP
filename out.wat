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
  (local $2 i32)
  (set_local $0
   (i32.const 1)
  )
  (set_local $1
   (i32.const 1)
  )
  (set_local $2
   (i32.const 0)
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
  (block $while0
   (loop $loop1
    (br_if $while0
     (i32.eqz
      (i32.lt_s
       (get_local $2)
       (i32.const 2)
      )
     )
    )
    (block
     (set_local $2
      (i32.add
       (get_local $2)
       (i32.const 1)
      )
     )
     (block $while2
      (loop $loop3
       (br_if $while2
        (i32.eqz
         (i32.gt_s
          (get_local $1)
          (i32.sub
           (i32.const 0)
           (i32.const 3)
          )
         )
        )
       )
       (block
        (set_local $1
         (i32.sub
          (get_local $1)
          (i32.const 1)
         )
        )
        (if
         (i32.eq
          (get_local $1)
          (i32.sub
           (i32.const 0)
           (i32.const 1)
          )
         )
         (br $while2)
        )
        (set_local $0
         (i32.add
          (get_local $0)
          (i32.const 1)
         )
        )
       )
       (br $loop3)
      )
     )
    )
    (br $loop1)
   )
  )
  (return
   (i32.add
    (get_local $0)
    (get_local $2)
   )
  )
 )
)
