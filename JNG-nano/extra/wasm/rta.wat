(module
  (memory (export "memory") 1)
  (func (export "red_to_alpha") (param $ptr i32) (param $len i32)
    (local $i i32)
    (local $end i32)
    (local $off i32)
    (local $v v128)
    (local $r v128)
    (local $res v128)
    (local.set $end (i32.add (local.get $ptr) (local.get $len)))
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $len)))

        ;; Загрузка 16 байт (4 пикселя RGBA)
        (local.set $off (i32.add (local.get $ptr) (local.get $i)))
        (local.set $v (v128.load (local.get $off)))

        ;; Извлекаем RED (каждый 4-й байт: 0,4,8,12)
        (local.set $r (i8x16.shuffle 0 4 8 12 0 4 8 12 0 4 8 12 0 4 8 12 (local.get $v) (local.get $v)))

        ;; Копируем RED в ALPHA (каждый 4-й байт начиная с 3)
        (local.set $res (i8x16.replace_lane 3 (local.get $v) (i8x16.extract_lane_u 0 (local.get $r))))
        (local.set $res (i8x16.replace_lane 7 (local.get $res) (i8x16.extract_lane_u 4 (local.get $r))))
        (local.set $res (i8x16.replace_lane 11 (local.get $res) (i8x16.extract_lane_u 8 (local.get $r))))
        (local.set $res (i8x16.replace_lane 15 (local.get $res) (i8x16.extract_lane_u 12 (local.get $r))))
        (v128.store (local.get $off) (local.get $res))
        (local.set $i (i32.add (local.get $i) (i32.const 16)))
        (br 0)
      )
    )

    ;; Оставшиеся пиксели (скалярно)
    (loop $scalar
      (br_if $scalar (i32.lt_u (local.get $i) (local.get $len)))
      (return)
    )
  )
)
