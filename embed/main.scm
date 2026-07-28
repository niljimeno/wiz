(def init
  {:variable false
   :input ""
   :todo false
   :form {:name ""
          :subscribed false
          :date ""}})

(defn update [model action]
  (case (action :type)
    :change-variable (set model :variable (action :value))
    :input-change (set model :input (action :value))
    :form-change (set model :form
      (set (model :form) (action :field) (action :value)))
    :todo-loaded (set model :todo (action :value))
    model))

(defn view [model]
  (div
    (button
      {:on-click {:type :change-variable
                  :value (not (model :variable))}}
      "change variable")

    (div
      (button
        {:on-click (navigate "/hello")}
        "change hello")
      (or (location "/" (p "hello"))
          (location "/hello" (p "world")))

      (p (string (model :variable)))
      (location "/hello" (p "hello")))


    [:br]
    (p (string (reverse (model :input))))

    ,(repeat 2 (input {:type "text"
            :value (model :input)
            :on-input (lambda [event]
              {:type :input-change
               :value ((event :target) :value)})}))

   [:br]
    (let [fdata (model :form)]
      (form {:on-submit (lambda [_] (print fdata))}
        (label "Name"
          (input {:type "text"
                  :value (fdata :name)
                  :on-input (lambda [event]
                    {:type :form-change
                     :field :name
                     :value ((event :target) :value)})}))
        (label
          (input {:type "checkbox"
                  :checked (fdata :subscribed)
                  :on-input (lambda [event]
                    {:type :form-change
                     :field :subscribed
                     :value ((event :target) :checked)})})
          "Subscribe")
        (label "Date"
          (input {:type "date"
                  :value (fdata :date)
                  :on-change (lambda [event]
                    {:type :form-change
                     :field :date
                     :value ((event :target) :value)})}))
        (p (string "Name:" (fdata :name)))
        (p (string "Subscribed:" (fdata :subscribed)))
        (p (string "Date:" (fdata :date)))
        (input {:type "submit"})))
    (button
      {:on-click (httpReq :todo-loaded
        {:url "https://jsonplaceholder.typicode.com/todos/1"})}
      "load todo")
    (if (model :todo)
      (p ((model :todo) :title)))))
