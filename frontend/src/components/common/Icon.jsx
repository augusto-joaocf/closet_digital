import house from '../../assets/icons/house-solid.png';
import shirt from '../../assets/icons/shirt-solid.png';
import folder from '../../assets/icons/folder-open-solid.png';
import user from '../../assets/icons/user-solid.png';
import search from '../../assets/icons/magnifying-glass-solid.png';
import filter from '../../assets/icons/filter-solid.png';
import heart from '../../assets/icons/heart-regular.png';
import heartFilled from '../../assets/icons/heart-solid.png';
import hanger from '../../assets/icons/clothes-hanger-regular.png';

const icons = { house, shirt, folder, user, search, filter, heart, heartFilled, hanger };
export default function Icon({ name, className = '' }) {
  return <img className={`icon ${className}`} src={icons[name]} alt="" aria-hidden="true" />;
}
