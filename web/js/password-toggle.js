document.addEventListener("DOMContentLoaded", function () {
  var toggleButtons = document.querySelectorAll(".password-toggle");
  toggleButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var targetId = button.getAttribute("data-target");
      if (!targetId) return;

      var input = document.getElementById(targetId);
      if (!input) return;

      var isText = input.type === "text";
      input.type = isText ? "password" : "text";

      var icon = button.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }

      button.setAttribute(
        "aria-label",
        (isText ? "Show" : "Hide") + " password"
      );
    });
  });
});
