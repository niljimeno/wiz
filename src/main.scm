(defn test []
  (def caca 10)
  (print (string "hello" caca))

  (def numbers [1 2 3])
  (print numbers)

  (print (map (lambda [x] (+ x 1)) numbers))

  (defn add [x y] (+ x y))
  (print (add 2 3))

  (let ((caca 20))
   (print caca)
   (let ((caca2 66))
    (print caca2)
    (print (+ caca caca2 3))))

  (print caca)

  (print {:caca caca :modern-caca (+ caca 20)}))

(defn view []
  [:div
    [:h1 (string "function test is now" ((partial + 1) 1))]
    [:h1 "good to see you < here"]
    [:form
      [:input {:type "text"}]
      [:input {:type "submit"}]]
    (if true [:h1 "tr\\ue!"] [:h1 "false :c"])
  ])

(defn main []
  (print "he\"ll\\o")
  (test)
  (html (view)))
