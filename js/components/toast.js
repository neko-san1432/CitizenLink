export default function showMessage(type, message) {
  const toast = document.getElementById("toast");
  switch (type) {
    case "message":
      toast.innerHTML = `${message}`;
      setTimeout(() => {
        toast.innerHTML = ``;
      }, 5000);
      break;
    case "error":
      toast.innerHTML = `${message}`;
      setTimeout(() => {
        toast.innerHTML = ``;
      }, 5000);
      break;
    default:
      toast.innerHTML = `${message}`;
      setTimeout(() => {
        toast.innerHTML = ``;
      }, 5000);
      break;
  }
}
