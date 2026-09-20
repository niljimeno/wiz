(def init
  {:page :overview})

(defn update [model action]
  (print action)
  (case (action :type)
        :go-page (set model :page (action :value))
        model))

(defn title-main [title]
  (h1
     {:class "text-4xl font-bold my-4"}
     title))

(defn title [text]
  (h2
   {:class "text-2xl font-bold mt-12"}
   text))

(defn script [text]
    (pre (code
          {:class "language-clojure"}
          text)))

(def sidepages
  {:overview
   (main
    {:class "flex-[4]"}
    (title-main "Wizard Scheme")
    (p "Wiz or Wizard Scheme is an experimental programming language
        for reactive frontend development with scheme syntax.
        It's not meant for production use.")
    (script "(defn main []
  (print \"hello\"))")
    (title "Core API")
    )
   :hello-world
   (main
    (h1 "fuck"))})

(defn header-title []
  )

(defn top-bar []
  (header
   (h1
    {:class "font-bold"}
    "Wi")))

(defn home []
  (main
   {:class "flex-[4]"}
   (h1
    {:class "text-4xl font-bold my-4"}
    "Wizard scheme")
   (p "Wiz or Wizard Scheme is an experimental programming language
       for reactive frontend development with scheme syntax.
       It's not meant for production use.")
   (pre (code
         {:class "language-clojure"}
"(defn main []
  (print \"hello\"))"))
   ,(repeat 2 (br))
   (title "Core API")
   ))

(defn not-found []
  (p "404"))

(defn view [model]
  (div
   {:class "p-4 max-w-220 mx-auto flex gap-4"}
   (div
    {:class "flex-[1] m-4"
      :on-click {:type :go-page
                 :value :overview}
     }
    (button
     {:href "/"
      :class "p-1 block w-full hover:text-bg hover:bg-fg cursor-pointer text-left font-bold"}
     "Overview")
    (button
     {:class "p-1 block w-full hover:text-bg hover:bg-fg cursor-pointer text-left"
      :on-click {:type :go-page
                 :value :hello-world}
      }
     "Hello world")
    (button
     {:href "/"
      :class "p-1 block w-full hover:text-bg hover:bg-fg cursor-pointer text-left"}
     "Variables"))
   (sidepages (model :page))))
