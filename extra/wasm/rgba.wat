(module
  (memory (export "memory") 16 8192)
  (func (export "merge_alpha")
    (param $dst i32)      ;; куда писать RGBA
    (param $src_rgbx i32) ;; откуда брать RGBX
    (param $src_axxx i32) ;; откуда брать AXXX
    (param $len i32)      ;; длина в байтах (кратно 16)
    (local $i i32)
    (local $v_rgbx v128)
    (local $v_axxx v128)
    (local $v_a v128)
    (local $res v128)
    (local $src_idx i32)
    (local $dst_idx i32)
    (local $a_idx i32)
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $len)))
        ;; Загрузка 16 байт RGBX и AXXX
        (local.set $v_rgbx (v128.load (i32.add (local.get $src_rgbx) (local.get $i))))
        (local.set $v_axxx (v128.load (i32.add (local.get $src_axxx) (local.get $i))))
        ;; Извлекаем альфу: 0,4,8,12
        (local.set $v_a (i8x16.shuffle 0 4 8 12 0 4 8 12 0 4 8 12 0 4 8 12 (local.get $v_axxx) (local.get $v_axxx)))
        ;; Собираем RGBA: R,G,B из RGBX, A из v_a
        (local.set $res (i8x16.shuffle
            0 1 2 16   ;; R,G,B,A0
            4 5 6 17   ;; R,G,B,A1
            8 9 10 18  ;; R,G,B,A2
            12 13 14 19 ;; R,G,B,A3
            (local.get $v_rgbx) (local.get $v_a)
        ))
        (v128.store (i32.add (local.get $dst) (local.get $i)) (local.get $res))
        (local.set $i (i32.add (local.get $i) (i32.const 16)))
        (br 0)
      )
    )
    ;; Скалярный хвост
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $src_idx (i32.add (local.get $src_rgbx) (local.get $i)))
        (local.set $a_idx (i32.add (local.get $src_axxx) (local.get $i)))
        (local.set $dst_idx (i32.add (local.get $dst) (local.get $i)))
        ;; R
        (i32.store8 (local.get $dst_idx) (i32.load8_u (local.get $src_idx)))
        ;; G
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 1)) (i32.load8_u (i32.add (local.get $src_idx) (i32.const 1))))
        ;; B
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 2)) (i32.load8_u (i32.add (local.get $src_idx) (i32.const 2))))
        ;; A
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 3)) (i32.load8_u (local.get $a_idx)))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br 0)
      )
    )
  )
)
