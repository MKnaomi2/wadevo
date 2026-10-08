// Wadevo Studios: small interactions. No fake controls: every control here
// does something real (menu toggle, year stamp).

(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var list = document.getElementById("nav-list");

  if (toggle && list) {
    toggle.addEventListener("click", function () {
      var open = list.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close the menu when a link is chosen
    list.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        list.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Footer year
  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
